"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { VariantSummary } from "@/lib/dto/products";
import { MAX_QUANTITY_PER_ORDER } from "@/lib/checkout";

const POLL_INTERVAL_MS = 10_000;

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-QA", { style: "currency", currency }).format(cents / 100);
}

function availabilityLabel(count: number | undefined) {
  if (count === undefined) return "Checking stock…";
  if (count <= 0) return "Sold out";
  if (count <= 5) return `Only ${count} left`;
  return "In stock";
}

export function ProductBuyBox({
  variants,
  currency,
}: {
  variants: VariantSummary[];
  currency: string;
}) {
  const router = useRouter();
  const [stock, setStock] = useState<Record<string, number>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const variantIds = variants.map((v) => v.id).join(",");
    if (!variantIds) return;

    async function fetchStock() {
      try {
        const res = await fetch(`/api/stock?variantIds=${variantIds}`, { cache: "no-store" });
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
  const maxQuantity = Math.min(MAX_QUANTITY_PER_ORDER, selectedStock ?? MAX_QUANTITY_PER_ORDER);
  const quantityOptions = useMemo(
    () => Array.from({ length: Math.max(maxQuantity, 1) }, (_, i) => i + 1),
    [maxQuantity],
  );

  function selectVariant(id: string, soldOut: boolean) {
    if (soldOut) return;
    setSelectedId(id);
    setQuantity(1);
  }

  function handleCheckout() {
    if (!selectedId) return;
    router.push(`/checkout?variant=${selectedId}&qty=${quantity}`);
  }

  return (
    <div>
      <fieldset className="divide-y divide-zinc-200 dark:divide-zinc-800">
        <legend className="sr-only">Size</legend>
        {variants.map((variant) => {
          const count = stock[variant.id];
          const soldOut = count !== undefined && count <= 0;
          const selected = selectedId === variant.id;
          return (
            <label
              key={variant.id}
              className={`flex items-center justify-between py-3 text-sm ${
                soldOut ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="size"
                  disabled={soldOut}
                  checked={selected}
                  onChange={() => selectVariant(variant.id, soldOut)}
                />
                <span className="font-medium">{variant.size}</span>
              </span>
              <span className="text-zinc-500">{formatPrice(variant.priceCents, currency)}</span>
              <span className={soldOut ? "text-zinc-400" : "text-emerald-600"}>
                {availabilityLabel(count)}
              </span>
            </label>
          );
        })}
      </fieldset>

      {selectedId ? (
        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="quantity" className="text-sm font-medium">
            Qty
          </label>
          <select
            id="quantity"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {quantityOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCheckout}
            className="ml-auto rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Checkout
          </button>
        </div>
      ) : null}
    </div>
  );
}
