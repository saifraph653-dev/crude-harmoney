// Every export in this file is cached and becomes part of the static shell.
// Live stock is deliberately NOT read here -- see app/api/stock/route.ts.
// This directive must be the file's literal first line to be recognized.
"use cache";

import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "./supabase/public";
import type { ProductDetail, ProductSummary, VariantSummary } from "./dto/products";

type ProductImageRow = {
  image_path: string | null;
  image_width: number | null;
  image_height: number | null;
};

function toImage(row: ProductImageRow) {
  if (!row.image_path || !row.image_width || !row.image_height) return null;
  return { path: row.image_path, width: row.image_width, height: row.image_height };
}

export async function getLiveProductSlugs(): Promise<string[]> {
  cacheLife("minutes");
  cacheTag("products");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .eq("status", "live");

  if (error) throw new Error(`getLiveProductSlugs: ${error.message}`);
  return (data ?? []).map((row) => row.slug);
}

export async function getDropProducts(): Promise<ProductSummary[]> {
  cacheLife("minutes");
  cacheTag("products");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "slug, name, status, collection, currency, image_path, image_width, image_height, variants(price_cents)",
    )
    .in("status", ["live", "ended"])
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getDropProducts: ${error.message}`);

  return (data ?? []).map((row) => {
    const prices = (row.variants ?? []).map((v) => v.price_cents);
    return {
      slug: row.slug,
      name: row.name,
      status: row.status as "live" | "ended",
      collection: row.collection as ProductSummary["collection"],
      currency: row.currency,
      image: toImage(row),
      fromPriceCents: prices.length > 0 ? Math.min(...prices) : null,
    };
  });
}

export async function getProductDetailBySlug(slug: string): Promise<ProductDetail | null> {
  cacheLife("minutes");
  cacheTag("products");
  cacheTag(`product:${slug}`);

  const supabase = createPublicClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select(
      "id, slug, name, description, status, collection, currency, image_path, image_width, image_height",
    )
    .eq("slug", slug)
    .in("status", ["live", "ended"])
    .maybeSingle();

  if (productError) throw new Error(`getProductDetailBySlug: ${productError.message}`);
  if (!product) return null;

  const { data: variantRows, error: variantsError } = await supabase
    .from("variants")
    .select("id, size, price_cents")
    .eq("product_id", product.id)
    .order("sort_order", { ascending: true });

  if (variantsError) throw new Error(`getProductDetailBySlug variants: ${variantsError.message}`);

  const variants: VariantSummary[] = (variantRows ?? []).map((row) => ({
    id: row.id,
    size: row.size,
    priceCents: row.price_cents,
  }));

  const prices = variants.map((v) => v.priceCents);

  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    status: product.status as "live" | "ended",
    collection: product.collection as ProductDetail["collection"],
    currency: product.currency,
    image: toImage(product),
    fromPriceCents: prices.length > 0 ? Math.min(...prices) : null,
    variants,
  };
}
