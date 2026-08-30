import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getCheckoutVariants } from "@/lib/checkout-data";
import { BAG_COOKIE, MAX_BAG_UNITS, parseBag } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { setLineQuantity } from "./actions";

// Reads a cookie and live stock, so there is nothing cacheable here.
export const instant = false;

export const metadata: Metadata = {
  title: "Bag",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const store = await cookies();
  const bag = parseBag(store.get(BAG_COOKIE)?.value);
  const variants = await getCheckoutVariants(bag.map((l) => l.variantId));

  // Reconcile the bag against what actually came back. A line whose
  // variant was deleted, or whose product is no longer live, is shown as
  // unavailable rather than silently dropped -- the customer put it there
  // and should see what happened to it.
  const lines = bag.map((line) => {
    const variant = variants.find((v) => v.id === line.variantId) ?? null;
    const available =
      variant !== null &&
      variant.productStatus === "live" &&
      variant.stockCount >= line.quantity;
    return { ...line, variant, available };
  });

  const sellable = lines.filter((l) => l.available && l.variant);
  const subtotal = sellable.reduce(
    (sum, l) => sum + (l.variant?.priceCents ?? 0) * l.quantity,
    0,
  );
  const currency = sellable[0]?.variant?.currency ?? "QAR";
  const blocked = lines.length > 0 && sellable.length !== lines.length;

  if (lines.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-6 sm:py-24">
        <h1 className="section-title">Your bag</h1>
        <p className="mt-3 max-w-sm text-muted">
          Nothing in it yet.
        </p>
        <Link href="/drops" className="btn-primary mt-8">
          See the collection
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-16">
      <h1 className="section-title">Your bag</h1>

      <ul className="mt-8 border-t border-border">
        {lines.map((line) => (
          <li
            key={line.variantId}
            className="flex gap-4 border-b border-border py-5 sm:gap-6"
          >
            <div className="w-20 shrink-0 sm:w-24">
              <div className="card-frame">
                {line.variant ? (
                  <Image
                    src={`/products/${line.variant.productSlug}.svg`}
                    alt=""
                    width={1000}
                    height={1250}
                    sizes="96px"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate font-medium">
                  {line.variant?.productName ?? "Unavailable piece"}
                </p>
                {line.variant ? (
                  <p className="shrink-0 text-sm text-muted">
                    {formatPrice(line.variant.priceCents * line.quantity, line.variant.currency)}
                  </p>
                ) : null}
              </div>
              <p className="eyebrow mt-1">Size {line.variant?.size ?? "—"}</p>

              {!line.available ? (
                <p className="mt-2 text-sm text-danger">
                  {line.variant === null
                    ? "This piece is no longer listed."
                    : line.variant.productStatus !== "live"
                      ? "This drop is not open right now."
                      : `Only ${line.variant.stockCount} left — reduce the quantity to continue.`}
                </p>
              ) : null}

              <div className="mt-3 flex items-center gap-3">
                {/* A form per quantity, so the whole control works without
                    JavaScript. */}
                <form action={setLineQuantity} className="flex items-center gap-2">
                  <input type="hidden" name="variantId" value={line.variantId} />
                  <label htmlFor={`qty-${line.variantId}`} className="eyebrow">
                    Qty
                  </label>
                  <select
                    id={`qty-${line.variantId}`}
                    name="quantity"
                    defaultValue={line.quantity}
                    className="h-11 rounded-[2px] border border-border-strong bg-surface px-3 text-sm"
                  >
                    {Array.from({ length: MAX_BAG_UNITS }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="link-quiet underline">
                    Update
                  </button>
                </form>

                <form action={setLineQuantity}>
                  <input type="hidden" name="variantId" value={line.variantId} />
                  <input type="hidden" name="quantity" value="0" />
                  <button
                    type="submit"
                    className="text-sm text-subtle underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Subtotal</p>
          <p className="mt-1 text-xl font-semibold">{formatPrice(subtotal, currency)}</p>
          <p className="mt-1 text-xs text-subtle">Shipping calculated at checkout.</p>
        </div>

        {blocked ? (
          <p className="text-sm text-danger">
            Sort the flagged lines above to continue.
          </p>
        ) : (
          <Link href="/checkout" className="btn-primary w-full sm:w-auto">
            Checkout
          </Link>
        )}
      </div>

      <p className="mt-6 text-xs text-subtle">
        Limit {MAX_BAG_UNITS} pieces per order — the runs are counted.
      </p>
    </main>
  );
}
