import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: product data is cached ("use cache", see
  // lib/products.ts) so pages never hit Postgres directly; live stock is
  // fetched separately, never baked into the cache. Every page is
  // dynamically rendered anyway because of the nonce-based CSP (see
  // proxy.ts), which is incompatible with Partial Prerendering's static
  // shell -- that trade-off is discussed in SECURITY.md. See
  // node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md.
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },

  // Security headers that don't need a per-request value (contrast with
  // Content-Security-Policy, set in proxy.ts because it needs a fresh
  // nonce every request). Verified in tests/security-headers.test.ts.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Defense in depth alongside the CSP's frame-ancestors 'none'
          // (proxy.ts) -- redundant in modern browsers, harmless, and
          // still checked by some older tooling/scanners.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
