"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  BAG_COOKIE,
  MAX_BAG_UNITS,
  addLine,
  dedupe,
  parseBag,
  serialiseBag,
} from "@/lib/cart";

// Mutations go through server actions rather than client-side cookie
// writes so the bag works with JavaScript disabled and every write is
// validated in one place. The cookie is not HttpOnly-sensitive data --
// it holds variant ids and counts, no PII and no pricing -- but it is
// SameSite=Lax so it does not ride along on cross-site requests.
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 14,
};

const addSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(MAX_BAG_UNITS),
});

const lineSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0).max(MAX_BAG_UNITS),
});

async function readBag() {
  const store = await cookies();
  return parseBag(store.get(BAG_COOKIE)?.value);
}

async function writeBag(lines: ReturnType<typeof dedupe>) {
  const store = await cookies();
  if (lines.length === 0) store.delete(BAG_COOKIE);
  else store.set(BAG_COOKIE, serialiseBag(lines), COOKIE_OPTIONS);
}

export async function addToBag(formData: FormData) {
  const parsed = addSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
  });
  // A malformed add is a no-op: the size selector is the only thing that
  // produces these, so there is no useful message to show a customer.
  if (!parsed.success) return;

  const { lines } = addLine(await readBag(), parsed.data.variantId, parsed.data.quantity);
  await writeBag(lines);
  revalidatePath("/cart");
}

/** Set one line's quantity. Zero removes it, which is what the × does. */
export async function setLineQuantity(formData: FormData) {
  const parsed = lineSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) return;

  const current = await readBag();
  const next =
    parsed.data.quantity === 0
      ? current.filter((l) => l.variantId !== parsed.data.variantId)
      : current.map((l) =>
          l.variantId === parsed.data.variantId
            ? { ...l, quantity: parsed.data.quantity }
            : l,
        );

  await writeBag(dedupe(next));
  revalidatePath("/cart");
}

export async function clearBag() {
  await writeBag([]);
  revalidatePath("/cart");
}
