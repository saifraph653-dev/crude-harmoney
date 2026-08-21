#!/usr/bin/env node
// Seeds (or resets) a single product/variant dedicated to the k6 load
// test in load-test/checkout.js. Separate from the real product seed
// script -- this is synthetic test fixture data, not a real drop.
//
// Usage: node scripts/seed-load-test.mjs [--stock=30]

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const stockArg = process.argv.find((a) => a.startsWith("--stock="));
const stockCount = stockArg ? Number(stockArg.split("=")[1]) : 30;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (.env.local)");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const PRODUCT_SLUG = "k6-load-test";
const VARIANT_SKU = "K6-LOADTEST";

async function main() {
  const { data: product, error: productError } = await admin
    .from("products")
    .upsert(
      { slug: PRODUCT_SLUG, name: "K6 Load Test Product", status: "live" },
      { onConflict: "slug" },
    )
    .select("id, slug")
    .single();
  if (productError) throw productError;

  const { data: variant, error: variantError } = await admin
    .from("variants")
    .upsert(
      {
        product_id: product.id,
        size: "LOADTEST",
        sku: VARIANT_SKU,
        price_cents: 10000,
        stock_count: stockCount,
      },
      { onConflict: "sku" },
    )
    .select("id")
    .single();
  if (variantError) throw variantError;

  // Clear out orders from previous load test runs so stock/state don't
  // accumulate across runs (cascades to order_items/stock_reservations).
  await admin.from("orders").delete().like("email", "k6-%@example.com");
  await admin.from("variants").update({ stock_count: stockCount }).eq("id", variant.id);

  console.log(`Seeded product '${product.slug}' with variant ${variant.id} (stock=${stockCount}).`);
  console.log("");
  console.log("Run the load test with:");
  console.log(
    `  k6 run -e BASE_URL=http://localhost:3000 -e VARIANT_ID=${variant.id} load-test/checkout.js`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
