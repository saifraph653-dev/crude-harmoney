"use client";

import { useEffect, useMemo, useState } from "react";
import { addToBag } from "@/app/cart/actions";
import type { VariantSummary } from "@/lib/dto/products";
import { MAX_QUANTITY_PER_ORDER } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";

const POLL_INTERVAL_MS = 10_000;

function availabilityLabel(count: number | undefined) {
  if (count === undefined) return "…";
  if (count <= 0) return "Sold out";
  if (count <= 5) return `${count} left`;
  return "In stock";
}

export function ProductBuyBox({
  variants,
  currency,
}: {
  variants: VariantSummary[];
  currency: string;
}) {
  const [stock, setStock] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const variantIds = variants.map((v) => v.id).join(",");
    if (!variantIds) return;

    async function fetchStock() {
      try {
        const res = await fetch(`/api/stock?variantIds=${variantIds}`, {
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { stock: Record<string, number> };
        if (!cancelled) setStock(body.stock);
      } catch {
        // Transient network error -- next poll retries. Checkout re-verifies
        // stock server-side regardless of what this shows.
      }
    }

    fetchStock();
    const interval = setInterval(fetchStock, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [variants]);

  const selectedStock = selectedId ? stock[selectedId] : undefined;
  const maxQuantity = Math.min(
    MAX_QUANTITY_PER_ORDER,
    selectedStock ?? MAX_QUANTITY_PER_ORDER,
  );
  const quantityOptions = useMemo(
    () => Array.from({ length: Math.max(maxQuantity, 1) }, (_, i) => i + 1),
    [maxQuantity],
  );

  const allSoldOut =
    variants.length > 0 &&
    variants.every((v) => {
      const c = stock[v.id];
      return c !== undefined && c <= 0;
    });

  function selectVariant(id: string, soldOut: boolean) {
    if (soldOut) return;
    setSelectedId(id);
    setQuantity(1);
  }

  const selectedVariant = variants.find((v) => v.id === selectedId) ?? null;

  return (
    <div>
      {/* Size selector. Rendered as a radio group (not buttons) so it stays
          keyboard- and screen-reader-navigable; the input itself is visually
          hidden and the label tile carries the state. Tiles are 56px tall to
          clear the ~44px iOS minimum touch target. */}
      <fieldset>
        <legend className="eyebrow mb-3">Size</legend>
        <div className="grid grid-cols-4 gap-2">
          {variants.map((variant) => {
            const count = stock[variant.id];
            const soldOut = count !== undefined && count <= 0;
            const low = count !== undefined && count > 0 && count <= 5;
            const selected = selectedId === variant.id;
            return (
              <label
                key={variant.id}
                className={`relative flex h-14 cursor-pointer flex-col items-center justify-center rounded-[2px] border text-sm transition-colors ${
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : soldOut
                      ? "cursor-not-allowed border-border bg-inset text-subtle"
                      : "border-border-strong bg-surface hover:border-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="size"
                  className="sr-only"
                  disabled={soldOut}
                  checked={selected}
                  onChange={() => selectVariant(variant.id, soldOut)}
                />
                <span className="font-medium">{variant.size}</span>
                <span
                  className={`mt-0.5 text-[0.625rem] ${
                    selected
                      ? "text-background/70"
                      : soldOut
                        ? "text-subtle"
                        : low
                          ? "text-accent"
                          : "text-subtle"
                  }`}
                >
                  {availabilityLabel(count)}
                </span>
                {soldOut ? (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top left, transparent calc(50% - 1px), var(--border-strong) 50%, transparent calc(50% + 1px))",
                    }}
                  />
                ) : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      {allSoldOut ? (
        <p className="mt-5 rounded-[2px] border border-border bg-inset px-4 py-3 text-sm text-muted">
          Every size is sold out. This run is finished.
        </p>
      ) : null}

      {selectedVariant ? (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-3">
            <label htmlFor="quantity" className="text-sm font-medium">
              Quantity
            </label>
            <select
              id="quantity"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              // 16px font size: anything smaller makes iOS Safari zoom the
              // viewport when the control receives focus.
              className="h-11 rounded-[2px] border border-border-strong bg-surface px-3 text-base"
            >
              {quantityOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="ml-auto text-sm text-muted">
              {formatPrice(selectedVariant.priceCents * quantity, currency)}
            </span>
          </div>

          {/* A form rather than an onClick: the add still works with
              JavaScript off, and the server action is the only thing that
              can write the bag. */}
          <form action={addToBag}>
            <input type="hidden" name="variantId" value={selectedVariant.id} />
            <input type="hidden" name="quantity" value={quantity} />
            <button type="submit" className="btn-primary w-full">
              Add to bag
            </button>
          </form>
        </div>
      ) : (
        !allSoldOut && (
          <p className="mt-5 text-sm text-subtle">Select a size to continue.</p>
        )
      )}
    </div>
  );
}
