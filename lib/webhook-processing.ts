import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedWebhookEvent } from "./payments";

export type ProcessResult = { ok: true } | { ok: false; reason: string };

/**
 * Fulfilment logic, separated from the route handler so it's testable
 * without going through raw HTTP + signature verification each time.
 * The route handler is what enforces "verify signature, then parse, then
 * call this" -- this function assumes that already happened.
 */
export async function processPaymentWebhookEvent(
  admin: SupabaseClient,
  providerName: string,
  event: ParsedWebhookEvent,
): Promise<ProcessResult> {
  if (event.kind !== "payment_succeeded") {
    // payment_failed / unknown: nothing to fulfil. Still recorded in
    // webhook_events by the caller for the audit trail. There is no
    // retry-payment-on-the-same-order flow in v1 -- the reservation TTL
    // is what handles an abandoned/failed checkout.
    return { ok: true };
  }

  const { data: order, error: lookupError } = await admin
    .from("orders")
    .select("id")
    .eq("payment_provider", providerName)
    .eq("payment_provider_session_id", event.providerSessionId)
    .maybeSingle();

  if (lookupError) {
    return { ok: false, reason: `order_lookup_failed: ${lookupError.message}` };
  }
  if (!order) {
    return { ok: false, reason: "order_not_found" };
  }

  // The database is the only source of truth on whether this succeeds --
  // see fulfil_order_from_webhook() in supabase/migrations. It re-reads
  // and compares total_cents/currency itself; event.amountCents/currency
  // here is what the *webhook* claims was charged, never trusted blindly.
  const { data: result, error: rpcError } = await admin.rpc("fulfil_order_from_webhook", {
    p_order_id: order.id,
    p_amount_cents: event.amountCents,
    p_currency: event.currency,
  });

  if (rpcError) {
    return { ok: false, reason: `fulfil_rpc_failed: ${rpcError.message}` };
  }

  if (result === "fulfilled" || result === "already_fulfilled") {
    return { ok: true };
  }

  // amount_mismatch, order_not_payable, paid_but_reservation_lost: all
  // need manual review (see SECURITY.md). Surfaced via webhook_events'
  // processing_status/error_message, not silently retried.
  return { ok: false, reason: String(result) };
}
