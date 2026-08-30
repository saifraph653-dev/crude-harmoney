import Link from "next/link";
import { z } from "zod";

const searchParamsSchema = z.object({ order: z.string().optional() });

export const instant = false;

export default async function CheckoutCancelledPage(props: PageProps<"/checkout/cancelled">) {
  const rawParams = await props.searchParams;
  const parsed = searchParamsSchema.safeParse(rawParams);
  const orderNumber = parsed.success ? parsed.data.order : undefined;

  return (
    <main className="mx-auto max-w-lg px-6 py-12 text-center">
      <h1 className="section-title">Payment cancelled</h1>
      <p className="mt-2 text-sm text-muted">
        {orderNumber ? `Order ${orderNumber} wasn't` : "Your order wasn't"} charged. If
        the item is still in stock, your reservation holds it for a few more minutes.
      </p>
      <Link href="/drops" className="mt-4 inline-block text-sm underline">
        Back to drops
      </Link>
    </main>
  );
}
