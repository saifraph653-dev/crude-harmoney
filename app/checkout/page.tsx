import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getCheckoutVariants } from "@/lib/checkout-data";
import { BAG_COOKIE, parseBag } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { CheckoutForm } from "@/components/CheckoutForm";

// The bag is the source of truth for what is being bought; it is read from
// an HttpOnly cookie server-side, so nothing about the order originates in
// the browser except the shipping details.
export const instant = false;

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const store = await cookies();
  const bag = parseBag(store.get(BAG_COOKIE)?.value);

  if (bag.length === 0) {
    return <CheckoutError message="Your bag is empty." />;
  }

  const variants = await getCheckoutVariants(bag.map((l) => l.variantId));
  const lines = bag.map((line) => ({
    ...line,
    variant: variants.find((v) => v.id === line.variantId) ?? null,
  }));

  // Anything not currently sellable sends the customer back to the bag,
  // where the specific problem is spelled out per line, rather than failing
  // opaquely after they have typed an address.
  const unsellable = lines.some(
    (l) =>
      !l.variant ||
      l.variant.productStatus !== "live" ||
      l.variant.stockCount < l.quantity,
  );
  if (unsellable) {
    return <CheckoutError message="Something in your bag is no longer available." />;
  }

  const totalCents = lines.reduce(
    (sum, l) => sum + (l.variant?.priceCents ?? 0) * l.quantity,
    0,
  );
  const currency = lines[0]?.variant?.currency ?? "QAR";

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-14">
      <Link
        href="/cart"
        className="inline-flex items-center gap-1.5 text-sm text-subtle transition-colors hover:text-foreground"
      >
        <span aria-hidden>&larr;</span> Back
      </Link>

      <h1 className="section-title mt-5">
        Checkout
      </h1>

      <div className="mt-6 rounded-[2px] border border-border bg-surface p-5">
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.variantId} className="flex items-baseline justify-between gap-4 text-sm">
              <span className="text-muted">
                {l.variant?.productName} · {l.variant?.size} × {l.quantity}
              </span>
              <span className="shrink-0">
                {formatPrice((l.variant?.priceCents ?? 0) * l.quantity, currency)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
          <span className="font-medium">Total</span>
          <span className="text-lg font-semibold">
            {formatPrice(totalCents, currency)}
          </span>
        </div>
      </div>

      <CheckoutForm />
    </main>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-16 sm:px-6">
      <p className="text-muted">{message}</p>
      <Link
        href="/drops"
        className="mt-6 inline-flex h-12 items-center justify-center rounded-[2px] border border-border-strong px-6 text-sm font-medium transition-colors hover:border-foreground"
      >
        Back to drops
      </Link>
    </main>
  );
}
