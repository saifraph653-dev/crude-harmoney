"use client";

import { useEffect, useState } from "react";
import type { VariantSummary } from "@/lib/dto/products";

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

export function LiveStock({
  variants,
  currency,
}: {
  variants: VariantSummary[];
  currency: string;
}) {
  const [stock, setStock] = useState<Record<string, number>>({});

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
        // Transient network error -- next poll will retry. The checkout
        // flow re-verifies stock server-side regardless of what this shows.
      }
    }

    fetchStock();
    const interval = setInterval(fetchStock, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [variants]);

  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {variants.map((variant) => {
        const count = stock[variant.id];
        const soldOut = count !== undefined && count <= 0;
        return (
          <li
            key={variant.id}
            className="flex items-center justify-between py-3 text-sm"
          >
            <span className="font-medium">{variant.size}</span>
            <span className="text-zinc-500">{formatPrice(variant.priceCents, currency)}</span>
            <span className={soldOut ? "text-zinc-400" : "text-emerald-600"}>
              {availabilityLabel(count)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
