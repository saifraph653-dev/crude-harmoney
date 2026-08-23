import Link from "next/link";
import type { Metadata } from "next";
import { z } from "zod";
import { getCheckoutVariant } from "@/lib/checkout-data";
import { MAX_QUANTITY_PER_ORDER } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { CheckoutForm } from "@/components/CheckoutForm";

const searchParamsSchema = z.object({
  variant: z.string().uuid().optional(),
  qty: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_ORDER).optional().default(1),
});

// This page reads searchParams and does an uncached, always-fresh stock
// lookup by design (see lib/checkout-data.ts) -- it's a per-purchase-attempt
// page, not a hot browsing path, so there's no static shell worth having.
export const instant = false;

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const rawParams = await props.searchParams;
  const parsed = searchParamsSchema.safeParse({
    variant: typeof rawParams.variant === "string" ? rawParams.variant : undefined,
    qty: typeof rawParams.qty === "string" ? rawParams.qty : undefined,
  });

  if (!parsed.success || !parsed.data.variant) {
    return <CheckoutError message="Pick a size from a drop page to check out." />;
  }

  const { variant: variantId, qty } = parsed.data;
  const variant = await getCheckoutVariant(variantId);

  if (!variant || variant.productStatus !== "live") {
    return <CheckoutError message="That item isn't available." />;
  }

  const totalCents = variant.priceCents * qty;

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-14">
      <Link
        href={`/drops/${variant.productSlug}`}
        className="inline-flex items-center gap-1.5 text-sm text-subtle transition-colors hover:text-foreground"
      >
        <span aria-hidden>&larr;</span> Back
      </Link>

      <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
        Checkout
      </h1>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span className="text-muted">
            {variant.productName} · {variant.size} × {qty}
          </span>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-border pt-3">
          <span className="text-sm font-medium">Total</span>
          <span className="text-lg font-semibold">
            {formatPrice(totalCents, variant.currency)}
          </span>
        </div>
      </div>

      <CheckoutForm variantId={variantId} quantity={qty} />
    </main>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <p className="text-muted">{message}</p>
      <Link
        href="/drops"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-full border border-border-strong px-6 text-sm font-medium transition-colors hover:border-foreground"
      >
        Back to drops
      </Link>
    </main>
  );
}
