import { headers } from "next/headers";
import { turnstileEnabled } from "@/lib/turnstile-keys";
import { OrderLookupForm } from "@/components/OrderLookupForm";

// Forced dynamic (headers() is a runtime API) so the CSP nonce
// (proxy.ts) reaches this page's script tags -- see app/drops/page.tsx.
// Reading the nonce here doubles as that trigger: it's needed anyway to
// pass to the Turnstile <Script> tag.
export const instant = false;

export default async function OrderLookupPage() {
  const nonce = (await headers()).get("x-nonce");
  // A test sitekey in production renders Cloudflare's "Testing only" widget
  // to customers. Treated as unconfigured instead -- see lib/turnstile-keys.
  const rawSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const turnstileSiteKey = turnstileEnabled(rawSiteKey) ? rawSiteKey : "";

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="section-title">Track your order</h1>
      <p className="mt-1 text-sm text-muted">
        Enter your order number and the email you used at checkout.
      </p>
      <div className="mt-6">
        <OrderLookupForm nonce={nonce} turnstileSiteKey={turnstileSiteKey} />
      </div>
    </main>
  );
}
