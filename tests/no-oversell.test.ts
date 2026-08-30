import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

// The hard requirement: 200 concurrent buyers, N units, stock must never
// go negative and never more than N orders succeed. This fires 200
// concurrent RPC calls at a variant seeded with exactly 30 units and
// asserts exactly 30 succeed -- see reserve_stock_and_create_order() in
// supabase/migrations, which is what this is actually testing.

const STOCK_COUNT = 30;
const CONCURRENT_BUYERS = 200;

describe("no oversell under concurrency", () => {
  const admin = createAdminClient();
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    const slug = `test-oversell-${randomUUID()}`;
    const { data: product, error: productError } = await admin
      .from("products")
      .insert({ slug, name: "Oversell Test Product", status: "live" })
      .select("id")
      .single();
    if (productError || !product) throw new Error(`seed product: ${productError?.message}`);
    productId = product.id;

    const { data: variant, error: variantError } = await admin
      .from("variants")
      .insert({
        product_id: productId,
        size: "OS",
        sku: `TEST-OVERSELL-${randomUUID()}`,
        price_cents: 10000,
        stock_count: STOCK_COUNT,
      })
      .select("id")
      .single();
    if (variantError || !variant) throw new Error(`seed variant: ${variantError?.message}`);
    variantId = variant.id;
  });

  afterAll(async () => {
    // orders -> cascades order_items + stock_reservations
    await admin.from("orders").delete().like("email", "oversell-test-%@example.com");
    await admin.from("variants").delete().eq("id", variantId);
    await admin.from("products").delete().eq("id", productId);
  });

  it(
    `lets exactly ${STOCK_COUNT} of ${CONCURRENT_BUYERS} concurrent purchase attempts succeed`,
    async () => {
      const attempts = Array.from({ length: CONCURRENT_BUYERS }, (_, i) =>
        admin.rpc("reserve_stock_and_create_order", {
          p_variant_id: variantId,
          p_quantity: 1,
          p_email: `oversell-test-${i}@example.com`,
          p_shipping_name: "Test Buyer",
          p_shipping_address_line1: "1 Test St",
          p_shipping_address_line2: "",
          p_shipping_city: "Doha",
          p_shipping_country: "QA",
          p_shipping_postal_code: "",
          p_note: "",
        }),
      );

      const results = await Promise.all(attempts);

      const succeeded = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);
      const unexpectedErrors = failed.filter((r) => r.error?.message !== "insufficient_stock");

      expect(unexpectedErrors, "every failure must be insufficient_stock, nothing else").toEqual(
        [],
      );
      expect(succeeded.length).toBe(STOCK_COUNT);
      expect(failed.length).toBe(CONCURRENT_BUYERS - STOCK_COUNT);

      const { data: finalVariant, error: readError } = await admin
        .from("variants")
        .select("stock_count")
        .eq("id", variantId)
        .single();
      if (readError || !finalVariant) throw new Error(`read final stock: ${readError?.message}`);
      expect(finalVariant.stock_count).toBe(0);

      const { count: orderCount, error: countError } = await admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .like("email", "oversell-test-%@example.com");
      if (countError) throw new Error(`count orders: ${countError.message}`);
      expect(orderCount).toBe(STOCK_COUNT);
    },
    60_000,
  );
});
