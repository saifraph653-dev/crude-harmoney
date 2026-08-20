import Link from "next/link";
import { z } from "zod";
import { getCheckoutVariant } from "@/lib/checkout-data";
import { mapReservationError, MAX_QUANTITY_PER_ORDER } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { submitCheckout } from "./actions";

const searchParamsSchema = z.object({
  variant: z.string().uuid().optional(),
  qty: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_ORDER).optional().default(1),
  error: z.string().optional(),
});

// This page reads searchParams and does an uncached, always-fresh stock
// lookup by design (see lib/checkout-data.ts) -- it's a per-purchase-attempt
// page, not a hot browsing path, so there's no static shell worth having.
export const instant = false;

export default async function CheckoutPage(props: PageProps<"/checkout">) {
  const rawParams = await props.searchParams;
  const parsed = searchParamsSchema.safeParse({
    variant: typeof rawParams.variant === "string" ? rawParams.variant : undefined,
    qty: typeof rawParams.qty === "string" ? rawParams.qty : undefined,
    error: typeof rawParams.error === "string" ? rawParams.error : undefined,
  });

  if (!parsed.success || !parsed.data.variant) {
    return <CheckoutError message="Pick a size from a drop page to check out." />;
  }

  const { variant: variantId, qty, error } = parsed.data;
  const variant = await getCheckoutVariant(variantId);

  if (!variant || variant.productStatus !== "live") {
    return <CheckoutError message="That item isn't available." />;
  }

  const totalCents = variant.priceCents * qty;

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <Link href={`/drops/${variant.productSlug}`} className="text-sm text-zinc-500">
        &larr; Back
      </Link>

      <h1 className="mt-4 text-xl font-semibold">Checkout</h1>

      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-500">Item</dt>
          <dd>
            {variant.productName} — {variant.size} × {qty}
          </dd>
        </div>
        <div className="flex justify-between font-medium">
          <dt>Total</dt>
          <dd>{formatPrice(totalCents, variant.currency)}</dd>
        </div>
      </dl>

      {error ? (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {mapReservationError(error)}
        </p>
      ) : null}

      <form action={submitCheckout} className="mt-6 space-y-4">
        <input type="hidden" name="variantId" value={variantId} />
        <input type="hidden" name="quantity" value={qty} />

        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Full name" name="shippingName" autoComplete="name" required />
        <Field
          label="Address"
          name="shippingAddressLine1"
          autoComplete="address-line1"
          required
        />
        <Field
          label="Address line 2 (optional)"
          name="shippingAddressLine2"
          autoComplete="address-line2"
        />
        <div className="grid grid-cols-2 gap-4">
          <Field label="City" name="shippingCity" autoComplete="address-level2" required />
          <Field label="Country" name="shippingCountry" autoComplete="country-name" required />
        </div>
        <Field
          label="Postal code (optional)"
          name="shippingPostalCode"
          autoComplete="postal-code"
        />
        <div>
          <label className="block text-sm font-medium" htmlFor="note">
            Order note (optional)
          </label>
          <textarea
            id="note"
            name="note"
            maxLength={500}
            rows={2}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Continue to payment
        </button>
        <p className="text-xs text-zinc-500">
          Card details are entered on the payment provider&apos;s own page. This site never
          sees or stores them.
        </p>
      </form>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        maxLength={300}
        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </div>
  );
}

function CheckoutError({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <p>{message}</p>
      <Link href="/drops" className="mt-4 inline-block text-sm underline">
        Back to drops
      </Link>
    </main>
  );
}
