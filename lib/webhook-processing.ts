import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedWebhookEvent } from "./payments";
import { sendOrderConfirmationEmail } from "./email/send-order-confirmation";
import type { OrderConfirmationEmailInput } from "./email/order-confirmation";

export type ProcessResult = { ok: true; warning?: string } | { ok: false; reason: string };

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

  if (result === "already_fulfilled") {
    // Idempotent replay -- already fulfilled (and already emailed) by an
    // earlier delivery. Do not send a second confirmation email.
    return { ok: true };
  }

  if (result === "fulfilled") {
    // Best-effort: a failed email must never undo an already-fulfilled
    // order, or make the caller mark this webhook_events row 'failed'
    // (which would suggest fulfilment itself failed, and cause the
    // provider to keep retrying a webhook that already succeeded).
    try {
      await sendOrderConfirmationEmail(await loadOrderForEmail(admin, order.id));
    } catch (err) {
      return { ok: true, warning: `email_send_failed: ${(err as Error).message}` };
    }
    return { ok: true };
  }

  // amount_mismatch, order_not_payable, paid_but_reservation_lost: all
  // need manual review (see SECURITY.md). Surfaced via webhook_events'
  // processing_status/error_message, not silently retried.
  return { ok: false, reason: String(result) };
}

async function loadOrderForEmail(
  admin: SupabaseClient,
  orderId: string,
): Promise<OrderConfirmationEmailInput> {
  const { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "order_number, email, total_cents, currency, shipping_name, shipping_address_line1, shipping_address_line2, shipping_city, shipping_country, shipping_postal_code",
    )
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error(`loadOrderForEmail: ${orderError?.message ?? "order not found"}`);
  }

  const { data: items, error: itemsError } = await admin
    .from("order_items")
    .select("product_name_snapshot, variant_size_snapshot, unit_price_cents, quantity")
    .eq("order_id", orderId);

  if (itemsError) {
    throw new Error(`loadOrderForEmail items: ${itemsError.message}`);
  }

  return {
    orderNumber: order.order_number,
    email: order.email,
    totalCents: order.total_cents,
    currency: order.currency,
    items: (items ?? []).map((item) => ({
      productName: item.product_name_snapshot,
      size: item.variant_size_snapshot,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    })),
    shipping: {
      name: order.shipping_name,
      addressLine1: order.shipping_address_line1,
      addressLine2: order.shipping_address_line2,
      city: order.shipping_city,
      country: order.shipping_country,
      postalCode: order.shipping_postal_code,
    },
  };
}
