import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CSP needs a fresh nonce per request, which only Proxy (not
// next.config.ts's static `headers()`) can generate -- see
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
// Every other security header lives in next.config.ts since those don't
// need per-request values.
//
// Using nonces means every page is dynamically rendered (Partial
// Prerendering is incompatible with nonce-based CSP -- Next.js can only
// inject a nonce into framework scripts during server-side rendering,
// not into a build-time static shell). This was a deliberate, discussed
// trade-off: /drops loses CDN-edge static serving, but the data layer
// (lib/products.ts's "use cache" functions) still never hits Postgres
// directly, it serves from Next's cache instead -- see SECURITY.md.
//
// TODO once a real payment adapter (Dibsy/Tap) replaces MockPaymentAdapter:
// add that provider's hosted-checkout domain to script-src and frame-src
// below. Nothing needs to be added for the current mock adapter -- its
// "hosted page" is an internal /checkout/mock route, same origin.
//
// style-src is 'unsafe-inline' with NO nonce, deliberately -- next/image
// unconditionally sets an inline `style="color:transparent"` attribute
// on every <img> it renders (get-img-props.js; there's no supported prop
// to disable it), and CSP nonces don't cover inline style *attributes*
// at all, only <style nonce="..."> blocks. This codebase has zero inline
// <style> blocks (verified: `grep -c '<style' <(curl ... )` across every
// route is 0), so the actual exposure of this exception is nil beyond
// that one framework-fixed, non-attacker-controlled value. script-src
// has no such exception -- it stays strictly nonce-based.
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self' https://challenges.cloudflare.com;
    frame-src https://challenges.cloudflare.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `;

  const contentSecurityPolicyHeaderValue = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", contentSecurityPolicyHeaderValue);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
