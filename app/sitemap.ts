import type { MetadataRoute } from "next";
import { getDropProducts } from "@/lib/products";
import { getSiteUrl } from "@/lib/site-url";

// Product pages come from the database rather than a hardcoded list, so a
// new drop appears in the sitemap by being seeded, not by someone
// remembering to edit this file.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/drops`, changeFrequency: "weekly", priority: 0.8 },
  ];

  try {
    const products = await getDropProducts();
    return [
      ...staticRoutes,
      ...products.map((p) => ({
        url: `${base}/drops/${p.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // A sitemap that 500s is worse than a sitemap listing only the pages we
    // can name without the database.
    return staticRoutes;
  }
}
