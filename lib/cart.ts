import { z } from "zod";
import { MAX_QUANTITY_PER_ORDER } from "./checkout";

// The bag is a list of *requests* -- variant ids and quantities, nothing
// else. No prices, no names, no availability. Everything a customer could
// tamper with by editing a cookie is re-read from the database at render
// time and re-checked inside reserve_stock_and_create_order_multi(), so
// the worst a forged bag can do is ask for something it will not get.
export const BAG_COOKIE = "ch_bag";

// Mirrors the ceilings enforced in SQL. Five units per order across the
// whole bag, not per line, so five lines of five is not a way around the
// per-order cap on a counted run.
export const MAX_BAG_LINES = 5;
export const MAX_BAG_UNITS = MAX_QUANTITY_PER_ORDER;

export const bagLineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_BAG_UNITS),
});

export const bagSchema = z.array(bagLineSchema).max(MAX_BAG_LINES);

export type BagLine = z.infer<typeof bagLineSchema>;

/** Parse a bag cookie. Anything malformed is treated as an empty bag. */
export function parseBag(raw: string | undefined): BagLine[] {
  if (!raw) return [];
  try {
    const parsed = bagSchema.safeParse(JSON.parse(raw));
    return parsed.success ? dedupe(parsed.data) : [];
  } catch {
    return [];
  }
}

export function serialiseBag(lines: BagLine[]): string {
  return JSON.stringify(lines);
}

/** Collapse repeated variants, clamp to the per-order ceiling. */
export function dedupe(lines: BagLine[]): BagLine[] {
  const byVariant = new Map<string, number>();
  for (const line of lines) {
    byVariant.set(line.variantId, (byVariant.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...byVariant.entries()]
    .slice(0, MAX_BAG_LINES)
    .map(([variantId, quantity]) => ({
      variantId,
      quantity: Math.min(quantity, MAX_BAG_UNITS),
    }));
}

export function bagUnits(lines: BagLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

/**
 * Add to a bag, returning the new bag and whether the per-order ceiling
 * clipped the request. The caller surfaces that rather than silently
 * adding less than the customer asked for.
 */
export function addLine(
  lines: BagLine[],
  variantId: string,
  quantity: number,
): { lines: BagLine[]; clipped: boolean } {
  const existing = lines.find((l) => l.variantId === variantId);
  if (!existing && lines.length >= MAX_BAG_LINES) {
    return { lines, clipped: true };
  }
  const room = MAX_BAG_UNITS - bagUnits(lines);
  if (room <= 0) return { lines, clipped: true };

  const take = Math.min(quantity, room);
  const next = existing
    ? lines.map((l) =>
        l.variantId === variantId ? { ...l, quantity: l.quantity + take } : l,
      )
    : [...lines, { variantId, quantity: take }];

  return { lines: dedupe(next), clipped: take < quantity };
}
