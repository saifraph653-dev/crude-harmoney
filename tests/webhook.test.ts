import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { signMockWebhookPayload } from "@/lib/payments/mock-adapter";
import { POST as webhookHandler } from "@/app/api/webhooks/payment/route";

const WEBHOOK_URL = "http://localhost/api/webhooks/payment";
const SIGNATURE_HEADER = "x-mock-signature";

function postWebhook(rawBody: string, signature?: string) {
  return webhookHandler(
    new NextRequest(WEBHOOK_URL, {
      method: "POST",
      body: rawBody,
      headers: signature ? { [SIGNATURE_HEADER]: signature } : undefined,
    }),
  );
}

describe("payment webhook", () => {
  const admin = createAdminClient();
  let productId: string;
  let variantId: string;

  async function createPendingOrder(email: string) {
    const { data, error } = await admin.rpc("reserve_stock_and_create_order", {
      p_variant_id: variantId,
      p_quantity: 1,
      p_email: email,
      p_shipping_name: "Webhook Test",
      p_shipping_address_line1: "1 Test St",
      p_shipping_address_line2: "",
      p_shipping_city: "Doha",
      p_shipping_country: "QA",
      p_shipping_postal_code: "",
      p_note: "",
    });
    if (error || !data?.[0]) throw new Error(`createPendingOrder: ${error?.message}`);
    const order = data[0] as { order_id: string; total_cents: number; currency: string };

    const providerSessionId = `mock_${order.order_id}`;
    await admin
      .from("orders")
      .update({ payment_provider: "mock", payment_provider_session_id: providerSessionId })
      .eq("id", order.order_id);

    return { orderId: order.order_id, providerSessionId, totalCents: order.total_cents, currency: order.currency };
  }

  beforeAll(async () => {
    const slug = `test-webhook-${randomUUID()}`;
    const { data: product, error: productError } = await admin
      .from("products")
      .insert({ slug, name: "Webhook Test Product", status: "live" })
      .select("id")
      .single();
    if (productError || !product) throw new Error(`seed product: ${productError?.message}`);
    productId = product.id;

    const { data: variant, error: variantError } = await admin
      .from("variants")
      .insert({
        product_id: productId,
        size: "OS",
        sku: `TEST-WEBHOOK-${randomUUID()}`,
        price_cents: 10000,
        stock_count: 10,
      })
      .select("id")
      .single();
    if (variantError || !variant) throw new Error(`seed variant: ${variantError?.message}`);
    variantId = variant.id;
  });

  afterAll(async () => {
    await admin.from("webhook_events").delete().eq("provider", "mock").like("event_id", "test-%");
    await admin.from("orders").delete().like("email", "webhook-test-%@example.com");
    await admin.from("variants").delete().eq("id", variantId);
    await admin.from("products").delete().eq("id", productId);
  });

  it("rejects a request with no signature header", async () => {
    const body = JSON.stringify({ eventId: "test-no-sig", eventType: "payment.succeeded" });
    const res = await postWebhook(body);
    expect(res.status).toBe(401);
  });

  it("rejects a request with a wrong signature", async () => {
    const body = JSON.stringify({ eventId: "test-wrong-sig", eventType: "payment.succeeded" });
    const res = await postWebhook(body, "0".repeat(64));
    expect(res.status).toBe(401);
  });

  it("rejects a correctly-signed but unparseable body", async () => {
    const body = "not json";
    const res = await postWebhook(body, signMockWebhookPayload(body));
    expect(res.status).toBe(400);
  });

  it("fulfils an order on a valid succeeded event, and is idempotent on replay", async () => {
    const order = await createPendingOrder("webhook-test-1@example.com");
    const body = JSON.stringify({
      eventId: "test-fulfil-1",
      eventType: "payment.succeeded",
      providerSessionId: order.providerSessionId,
      amountCents: order.totalCents,
      currency: order.currency,
    });

    const firstRes = await postWebhook(body, signMockWebhookPayload(body));
    expect(firstRes.status).toBe(200);
    expect(await firstRes.json()).toEqual({ ok: true });

    const { data: orderRow } = await admin
      .from("orders")
      .select("status")
      .eq("id", order.orderId)
      .single();
    expect(orderRow?.status).toBe("paid");

    const { data: reservationRow } = await admin
      .from("stock_reservations")
      .select("status")
      .eq("order_id", order.orderId)
      .single();
    expect(reservationRow?.status).toBe("consumed");

    // Replay the exact same event (providers retry).
    const secondRes = await postWebhook(body, signMockWebhookPayload(body));
    expect(secondRes.status).toBe(200);
    expect(await secondRes.json()).toEqual({ ok: true, duplicate: true });

    const { data: orderRowAfterReplay } = await admin
      .from("orders")
      .select("status")
      .eq("id", order.orderId)
      .single();
    expect(orderRowAfterReplay?.status).toBe("paid");
  });

  it("flags an amount mismatch instead of fulfilling", async () => {
    const order = await createPendingOrder("webhook-test-2@example.com");
    const body = JSON.stringify({
      eventId: "test-mismatch-1",
      eventType: "payment.succeeded",
      providerSessionId: order.providerSessionId,
      amountCents: order.totalCents + 1,
      currency: order.currency,
    });

    const res = await postWebhook(body, signMockWebhookPayload(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, reason: "amount_mismatch" });

    const { data: orderRow } = await admin
      .from("orders")
      .select("status")
      .eq("id", order.orderId)
      .single();
    expect(orderRow?.status).toBe("pending");

    const { data: eventRow } = await admin
      .from("webhook_events")
      .select("processing_status, error_message")
      .eq("provider", "mock")
      .eq("event_id", "test-mismatch-1")
      .single();
    expect(eventRow?.processing_status).toBe("failed");
    expect(eventRow?.error_message).toBe("amount_mismatch");
  });
});
