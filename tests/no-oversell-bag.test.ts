import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

// The multi-line counterpart to no-oversell.test.ts. Two variants with
// different stock, bought together, hammered concurrently -- and half the
// callers list the lines in the opposite order to the other half.
//
// Two things are under test and neither is cosmetic:
//   1. The scarcer line caps the whole order, and the plentiful line is
//      NOT decremented by the attempts that failed on the scarce one. A
//      partial decrement here would leak stock on every sold-out race.
//   2. Listing the same two variants in opposite orders must not deadlock.
//      reserve_stock_and_create_order_multi() sorts by variant_id before
//      touching any row precisely so that every caller in the system takes
//      locks in the same sequence.

const STOCK_PLENTIFUL = 30;
const STOCK_SCARCE = 10;
const CONCURRENT_BUYERS = 200;

describe("no oversell across a multi-line bag", () => {
  const admin = createAdminClient();
  let productId: string;
  let plentifulId: string;
  let scarceId: string;

  beforeAll(async () => {
    const slug = `test-bag-oversell-${randomUUID()}`;
    const { data: product, error: productError } = await admin
      .from("products")
      .insert({ slug, name: "Bag Oversell Test", status: "live" })
      .select("id")
      .single();
    if (productError || !product) throw productError ?? new Error("no product");
    productId = product.id;

    const { data: variants, error: variantError } = await admin
      .from("variants")
      .insert([
        { product_id: productId, size: "M", sku: `${slug}-M`, price_cents: 18000, stock_count: STOCK_PLENTIFUL },
        { product_id: productId, size: "L", sku: `${slug}-L`, price_cents: 32000, stock_count: STOCK_SCARCE },
      ])
      .select("id, size");
    if (variantError || !variants) throw variantError ?? new Error("no variants");

    plentifulId = variants.find((v) => v.size === "M")!.id;
    scarceId = variants.find((v) => v.size === "L")!.id;
  });

  afterAll(async () => {
    await admin.from("products").delete().eq("id", productId);
  });

  it("caps at the scarcest line and never partially decrements", async () => {
    const attempts = Array.from({ length: CONCURRENT_BUYERS }, (_, i) => {
      // Opposite line orders between even and odd callers.
      const items =
        i % 2 === 0
          ? [
              { variant_id: plentifulId, quantity: 1 },
              { variant_id: scarceId, quantity: 1 },
            ]
          : [
              { variant_id: scarceId, quantity: 1 },
              { variant_id: plentifulId, quantity: 1 },
            ];

      return admin.rpc("reserve_stock_and_create_order_multi", {
        p_items: items,
        p_email: "concurrency@example.com",
        p_shipping_name: "Test Buyer",
        p_shipping_address_line1: "1 Test Street",
        p_shipping_address_line2: "",
        p_shipping_city: "Doha",
        p_shipping_country: "Qatar",
        p_shipping_postal_code: "",
        p_note: "",
      });
    });

    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => !r.error).length;
    const deadlocked = results.filter((r) => /deadlock/i.test(r.error?.message ?? "")).length;

    expect(deadlocked).toBe(0);
    expect(succeeded).toBe(STOCK_SCARCE);

    const { data: after } = await admin
      .from("variants")
      .select("id, stock_count")
      .in("id", [plentifulId, scarceId]);

    const plentiful = after!.find((v) => v.id === plentifulId)!;
    const scarce = after!.find((v) => v.id === scarceId)!;

    expect(scarce.stock_count).toBe(0);
    // The 190 failed attempts must have rolled back their decrement here.
    expect(plentiful.stock_count).toBe(STOCK_PLENTIFUL - STOCK_SCARCE);

    const { count: orderCount } = await admin
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .in("variant_id", [plentifulId, scarceId]);
    expect(orderCount).toBe(STOCK_SCARCE * 2);
  });
});
