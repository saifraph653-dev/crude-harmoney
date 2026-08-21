import { headers } from "next/headers";
import { OrderLookupForm } from "@/components/OrderLookupForm";

// Forced dynamic (headers() is a runtime API) so the CSP nonce
// (proxy.ts) reaches this page's script tags -- see app/drops/page.tsx.
// Reading the nonce here doubles as that trigger: it's needed anyway to
// pass to the Turnstile <Script> tag.
export const instant = false;

export default async function OrderLookupPage() {
  const nonce = (await headers()).get("x-nonce");
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="text-xl font-semibold">Track your order</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Enter your order number and the email you used at checkout.
      </p>
      <div className="mt-6">
        <OrderLookupForm nonce={nonce} turnstileSiteKey={turnstileSiteKey} />
      </div>
    </main>
  );
}
