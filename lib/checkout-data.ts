import { createPublicClient } from "./supabase/public";

export type CheckoutVariant = {
  id: string;
  size: string;
  priceCents: number;
  currency: string;
  stockCount: number;
  productName: string;
  productSlug: string;
  productStatus: "draft" | "live" | "ended";
};

// Deliberately not "use cache" -- this backs the checkout page, which is
// low-traffic (once per purchase attempt, not once per page view) and
// should always show current price/availability. The actual enforcement
// still happens server-side in reserve_stock_and_create_order(), this is
// purely informational.
export async function getCheckoutVariant(variantId: string): Promise<CheckoutVariant | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("variants")
    .select(
      "id, size, price_cents, stock_count, products(name, slug, status, currency)",
    )
    .eq("id", variantId)
    .maybeSingle();

  if (error || !data || !data.products) return null;

  const product = Array.isArray(data.products) ? data.products[0] : data.products;
  if (!product) return null;

  return {
    id: data.id,
    size: data.size,
    priceCents: data.price_cents,
    currency: product.currency,
    stockCount: data.stock_count,
    productName: product.name,
    productSlug: product.slug,
    productStatus: product.status,
  };
}
