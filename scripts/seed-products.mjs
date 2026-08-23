#!/usr/bin/env node
// Seeds products/variants for a drop from a JSON file. There is no CMS
// and no admin UI by design (see AGENTS.md/the brief) -- this script,
// run once per drop before it goes live, IS the product-entry workflow.
//
// Usage:
//   node scripts/seed-products.mjs [path-to-json]   (default: seed/products.json)
//
// Safe to re-run: a product whose slug already exists is SKIPPED
// entirely, never updated. This is deliberate, not a limitation --
// re-running with the original JSON must never silently reset
// stock_count on a product that has already sold units, and there is no
// way to distinguish "the operator fixed a typo" from "the operator is
// about to accidentally undo real sales" from inside this script. Once
// a product exists, edit it via the Supabase dashboard (Table Editor),
// per the project's "admin work happens in the Supabase dashboard" rule.

import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

config({ path: ".env.local", quiet: true });

const filePath = process.argv[2] ?? "seed/products.json";

const variantSchema = z
  .object({
    size: z.string().trim().min(1).max(50),
    sku: z.string().trim().min(1).max(50),
    priceCents: z.number().int().positive(),
    stockCount: z.number().int().min(0),
    sortOrder: z.number().int().default(0),
  })
  .strict();

const productSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase-kebab-case, e.g. 'midnight-hoodie'"),
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).default(""),
    status: z.enum(["draft", "coming_soon", "live", "ended"]).default("draft"),
    collection: z.enum(["classic", "limited"]).default("classic"),
    displayOrder: z.number().int().default(0),
    imagePath: z.string().trim().min(1).optional(),
    imageWidth: z.number().int().positive().optional(),
    imageHeight: z.number().int().positive().optional(),
    variants: z.array(variantSchema).min(1),
  })
  .strict()
  .refine(
    (p) => (p.imagePath == null) === (p.imageWidth == null) && (p.imagePath == null) === (p.imageHeight == null),
    { message: "imagePath, imageWidth, imageHeight must all be set together, or all omitted" },
  );

const fileSchema = z.array(productSchema).min(1);

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set (.env.local)");
    process.exit(1);
  }
  const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const raw = await readFile(filePath, "utf-8");
  const parsed = fileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    console.error(`${filePath} failed validation:`);
    console.error(z.prettifyError(parsed.error));
    process.exit(1);
  }

  for (const product of parsed.data) {
    const { data: existing, error: lookupError } = await admin
      .from("products")
      .select("id")
      .eq("slug", product.slug)
      .maybeSingle();
    if (lookupError) {
      console.error(`Failed looking up '${product.slug}': ${lookupError.message}`);
      process.exit(1);
    }
    if (existing) {
      console.log(`Skipping '${product.slug}' -- already exists (id ${existing.id}).`);
      continue;
    }

    const { data: inserted, error: productError } = await admin
      .from("products")
      .insert({
        slug: product.slug,
        name: product.name,
        description: product.description,
        status: product.status,
        collection: product.collection,
        display_order: product.displayOrder,
        image_path: product.imagePath ?? null,
        image_width: product.imageWidth ?? null,
        image_height: product.imageHeight ?? null,
      })
      .select("id")
      .single();
    if (productError || !inserted) {
      console.error(`Failed inserting product '${product.slug}': ${productError?.message}`);
      process.exit(1);
    }

    const { error: variantsError } = await admin.from("variants").insert(
      product.variants.map((v) => ({
        product_id: inserted.id,
        size: v.size,
        sku: v.sku,
        price_cents: v.priceCents,
        stock_count: v.stockCount,
        sort_order: v.sortOrder,
      })),
    );
    if (variantsError) {
      console.error(
        `Product '${product.slug}' was created (id ${inserted.id}) but its variants failed to ` +
          `insert: ${variantsError.message}\n` +
          `Fix via the Supabase dashboard -- either delete the product row and re-run this ` +
          `script, or add the missing variants manually.`,
      );
      process.exit(1);
    }

    console.log(
      `Created '${product.slug}' (${product.status}) with ${product.variants.length} variant(s).`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
