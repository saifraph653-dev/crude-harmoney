import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentAdapter } from "@/lib/payments";
import { processPaymentWebhookEvent } from "@/lib/webhook-processing";

// Rate limiting on this endpoint lands in the security-headers step
// (Upstash), per the brief's "rate limit checkout-session creation,
// order lookup, and the webhook endpoint" requirement.
//
// Response codes:
//  - 401: signature missing/invalid. The one case we actually reject at
//    the transport level, since it means either misconfiguration or a
//    forged request.
//  - 400: signature valid but the body couldn't be parsed as an event.
//    Plausibly transient/a bug on our side, worth a retry.
//  - 200: everything else, including business-logic failures (amount
//    mismatch, order not found, etc.) -- those are recorded with
//    processing_status='failed' in webhook_events for manual review.
//    Returning non-200 for a permanent failure would just cause the
//    provider to retry-storm us with the exact same bad data forever.
export async function POST(request: NextRequest) {
  // Raw text FIRST -- signature verification is over the exact bytes the
  // provider signed. Parsing (even implicitly, e.g. request.json()) here
  // would break that for any provider that signs the raw body.
  const rawBody = await request.text();

  const adapter = getPaymentAdapter();
  const signature = request.headers.get(adapter.webhookSignatureHeader);

  if (!adapter.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = adapter.parseWebhookEvent(rawBody);
  } catch {
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: insert-or-ignore on the unique (provider, event_id)
  // index, before any processing. If this is a fresh event, the insert
  // returns the new row. If PostgREST reports a conflict (ignored insert),
  // look the row up instead -- if it's already processing_status
  // 'processed', this is a true duplicate delivery and we skip
  // reprocessing. If it's still 'pending' or 'failed', a prior delivery
  // was recorded but never finished being processed (e.g. we crashed
  // between recording it and fulfilling the order), so we process it now
  // using the existing row -- this is what "providers retry" requires:
  // retries must eventually get processed, not just deduplicated away.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "malformed payload" }, { status: 400 });
  }

  const { data: freshRow } = await admin
    .from("webhook_events")
    .upsert(
      {
        provider: adapter.providerName,
        event_id: event.eventId,
        event_type: event.eventType,
        payload,
      },
      { onConflict: "provider,event_id", ignoreDuplicates: true },
    )
    .select("id, processing_status")
    .maybeSingle();

  let eventRow = freshRow;
  if (!eventRow) {
    const { data: existing } = await admin
      .from("webhook_events")
      .select("id, processing_status")
      .eq("provider", adapter.providerName)
      .eq("event_id", event.eventId)
      .maybeSingle();
    eventRow = existing;
  }

  if (!eventRow) {
    // Couldn't record or find the ledger row -- fail safe, don't process
    // without one. A retry from the provider will try again.
    return NextResponse.json({ error: "failed to record event" }, { status: 500 });
  }

  if (eventRow.processing_status === "processed") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const result = await processPaymentWebhookEvent(admin, adapter.providerName, event);

  await admin
    .from("webhook_events")
    .update({
      processing_status: result.ok ? "processed" : "failed",
      processed_at: new Date().toISOString(),
      error_message: result.ok ? null : result.reason,
    })
    .eq("id", eventRow.id);

  // Status is 200 either way -- see the comment block above. The body
  // still reports the real outcome, it's just not what drives whether
  // the provider retries.
  return NextResponse.json(result.ok ? { ok: true } : { ok: false, reason: result.reason });
}
