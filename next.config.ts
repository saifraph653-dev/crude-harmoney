import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: drop/product pages are cached ("use cache") and served
  // as a static shell; live stock is fetched separately, never baked into
  // the shell. See node_modules/next/dist/docs/01-app/01-getting-started/08-caching.md.
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
