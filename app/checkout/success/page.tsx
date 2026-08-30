import { z } from "zod";

const searchParamsSchema = z.object({ order: z.string().optional() });

// The browser redirect here is informational only -- it can be forged,
// lost, or double-fired, so it never fulfils anything. Fulfilment happens
// on the payment webhook (see the webhook step). This page just tells the
// customer what to expect; the real order lookup lands with that step too.
export const instant = false;

export default async function CheckoutSuccessPage(props: PageProps<"/checkout/success">) {
  const rawParams = await props.searchParams;
  const parsed = searchParamsSchema.safeParse(rawParams);
  const orderNumber = parsed.success ? parsed.data.order : undefined;

  return (
    <main className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="section-title">Thanks{orderNumber ? `, order ${orderNumber}` : ""}</h1>
      <p className="mt-2 text-sm text-muted">
        We&apos;re confirming your payment now. You&apos;ll get an email once
        it&apos;s confirmed -- this page updating doesn&apos;t mean the order
        is confirmed yet.
      </p>
    </main>
  );
}
