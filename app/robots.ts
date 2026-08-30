import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

// Checkout, the bag and order lookup carry per-customer state and have no
// business in an index; each also sets robots: noindex in its own metadata,
// this just saves crawlers the request.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/checkout/", "/orders/"],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
