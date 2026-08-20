import { z } from "zod";

const searchParamsSchema = z.object({
  orderNumber: z.string().optional(),
  amountCents: z.coerce.number().int().optional(),
  currency: z.string().optional(),
});

// Stand-in for the real hosted payment page (Dibsy/Tap) until the merchant
// account is approved -- see lib/payments/mock-adapter.ts. No card fields
// exist here or anywhere else in this codebase.
export const instant = false;

export default async function MockCheckoutPage(props: PageProps<"/checkout/mock/[sessionId]">) {
  const params = await props.params;
  const rawSearchParams = await props.searchParams;
  const parsed = searchParamsSchema.safeParse(rawSearchParams);
  const orderNumber = parsed.success ? parsed.data.orderNumber : undefined;
  const amountCents = parsed.success ? parsed.data.amountCents : undefined;
  const currency = parsed.success ? parsed.data.currency : undefined;

  return (
    <main className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="text-xl font-semibold">Mock payment page</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Session {params.sessionId}. This stands in for Dibsy/Tap&apos;s hosted checkout
        until a merchant account is wired up. Order {orderNumber ?? "?"} for{" "}
        {amountCents != null && currency
          ? new Intl.NumberFormat("en-QA", { style: "currency", currency }).format(
              amountCents / 100,
            )
          : "?"}{" "}
        is reserved and waiting on payment confirmation.
      </p>
      <p className="mt-4 text-xs text-zinc-400">
        There is deliberately no button here to simulate a payment -- that
        would be a live &quot;pay for any order for free&quot; endpoint if
        this ever shipped to production by accident. See README.md&apos;s
        &quot;Simulating a payment locally&quot; section for the signed curl
        request that exercises the real webhook path instead.
      </p>
    </main>
  );
}
