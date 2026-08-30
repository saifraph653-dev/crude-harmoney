import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST as lookupHandler } from "@/app/api/orders/lookup/route";

const LOOKUP_URL = "http://localhost/api/orders/lookup";
// .env.local's TURNSTILE_SECRET_KEY is Cloudflare's published "always
// passes" test key -- any non-empty response string verifies successfully
// against the real siteverify endpoint (see lib/turnstile.ts).
const VALID_TURNSTILE_TOKEN = "test-token";

function postLookup(body: Record<string, unknown>) {
  return lookupHandler(
    new NextRequest(LOOKUP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnstileToken: VALID_TURNSTILE_TOKEN, ...body }),
    }),
  );
}

describe("order lookup", () => {
  const admin = createAdminClient();
  let productId: string;
  let variantId: string;
  let orderNumber: string;
  const email = "lookup-test@example.com";

  beforeAll(async () => {
    const slug = `test-lookup-${randomUUID()}`;
    const { data: product, error: productError } = await admin
      .from("products")
      .insert({ slug, name: "Lookup Test Product", status: "live" })
      .select("id")
      .single();
    if (productError || !product) throw new Error(`seed product: ${productError?.message}`);
    productId = product.id;

    const { data: variant, error: variantError } = await admin
      .from("variants")
      .insert({
        product_id: productId,
        size: "OS",
        sku: `TEST-LOOKUP-${randomUUID()}`,
        price_cents: 5000,
        stock_count: 10,
      })
      .select("id")
      .single();
    if (variantError || !variant) throw new Error(`seed variant: ${variantError?.message}`);
    variantId = variant.id;

    const { data, error } = await admin.rpc("reserve_stock_and_create_order", {
      p_variant_id: variantId,
      p_quantity: 1,
      p_email: email,
      p_shipping_name: "Lookup Buyer",
      p_shipping_address_line1: "1 Lookup St",
      p_shipping_address_line2: "",
      p_shipping_city: "Doha",
      p_shipping_country: "QA",
      p_shipping_postal_code: "",
      p_note: "",
    });
    if (error || !data?.[0]) throw new Error(`seed order: ${error?.message}`);
    orderNumber = (data[0] as { order_number: string }).order_number;
  });

  afterAll(async () => {
    await admin.from("orders").delete().eq("email", email);
    await admin.from("variants").delete().eq("id", variantId);
    await admin.from("products").delete().eq("id", productId);
  });

  it("finds a real order with the matching order number and email", async () => {
    const res = await postLookup({ orderNumber, email });
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.orderNumber).toBe(orderNumber);
    expect(body.status).toBe("pending");
    expect(body.items).toHaveLength(1);
    expect(body.items[0].size).toBe("OS");
    expect(body.totalCents).toBe(5000);
  });

  it("returns the identical generic response for a nonexistent order number, a mismatched email, and malformed input", async () => {
    const nonexistent = await postLookup({ orderNumber: "CH-999999", email }).then((r) =>
      r.json(),
    );
    const wrongEmail = await postLookup({ orderNumber, email: "someone-else@example.com" }).then(
      (r) => r.json(),
    );
    const malformed = await postLookup({ orderNumber: "", email: "not-an-email" }).then((r) =>
      r.json(),
    );
    const extraField = await postLookup({ orderNumber, email, extra: "field" }).then((r) =>
      r.json(),
    );
    const missingTurnstileToken = await postLookup({
      orderNumber,
      email,
      turnstileToken: "",
    }).then((r) => r.json());

    expect(nonexistent).toEqual({ found: false });
    expect(wrongEmail).toEqual({ found: false });
    expect(missingTurnstileToken).toEqual({ found: false });
    expect(malformed).toEqual({ found: false });
    // .strict() rejects the unknown "extra" key entirely, same shape.
    expect(extraField).toEqual({ found: false });
  });

  it("takes roughly the same minimum time whether the order is found or not (anti-timing-oracle)", async () => {
    const start1 = Date.now();
    await postLookup({ orderNumber, email });
    const foundDuration = Date.now() - start1;

    const start2 = Date.now();
    await postLookup({ orderNumber: "CH-999999", email });
    const notFoundDuration = Date.now() - start2;

    expect(foundDuration).toBeGreaterThanOrEqual(350);
    expect(notFoundDuration).toBeGreaterThanOrEqual(350);
  });

  it("is case-insensitive on order number and email", async () => {
    const res = await postLookup({
      orderNumber: orderNumber.toLowerCase(),
      email: email.toUpperCase(),
    });
    const body = await res.json();
    expect(body.found).toBe(true);
  });
});
