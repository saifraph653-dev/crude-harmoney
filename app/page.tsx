import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { getDropProducts } from "@/lib/products";
import { ProductGrid } from "@/components/ProductGrid";

// Forced dynamic so the CSP nonce (proxy.ts) reaches this page's script
// tags -- see app/drops/page.tsx for the full explanation.
export const instant = false;

export default async function Home() {
  await connection();
  const products = await getDropProducts();
  const lead = products[0] ?? null;

  return (
    <main className="flex flex-1 flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Opening frame                                                       */}
      {/*                                                                     */}
      {/* A garment, full bleed, before any words. The previous version led   */}
      {/* with a headline, a paragraph, two stacked buttons and a disclaimer  */}
      {/* -- four blocks of text before a customer saw a single piece of      */}
      {/* clothing, which is a landing page, not a label.                     */}
      {/* ------------------------------------------------------------------ */}
      {lead?.image ? (
        <section className="relative">
          <div className="relative aspect-[4/5] w-full overflow-hidden sm:aspect-[16/9]">
            <Image
              src={lead.image.path}
              alt={lead.name}
              fill
              // The LCP element: eager, high priority, and sized so phones
              // never fetch the desktop crop.
              priority
              fetchPriority="high"
              sizes="100vw"
              className="object-cover object-[50%_38%]"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3"
              style={{
                background:
                  "linear-gradient(to top, rgba(12,11,10,0.92) 0%, rgba(12,11,10,0.35) 45%, transparent 100%)",
              }}
            />
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0">
            <div className="mx-auto w-full max-w-[88rem] px-5 pb-8 sm:px-8 sm:pb-14">
              <p className="eyebrow">Vol. 01 — Doha</p>
              <h1 className="display mt-3 max-w-[14ch]">
                Counted runs,
                <br />
                <span className="serif italic">pressed by hand.</span>
              </h1>
              <Link
                href="/drops"
                className="btn-primary pointer-events-auto mt-7 inline-flex"
              >
                The collection
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* The collection                                                      */}
      {/* ------------------------------------------------------------------ */}
      {products.length > 0 ? (
        <section className="mx-auto w-full max-w-[88rem] px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-4">
            <h2 className="eyebrow">Vol. 01</h2>
            <span className="eyebrow">
              {products.every((p) => p.status === "coming_soon")
                ? "Coming soon"
                : `${products.length} piece${products.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <ProductGrid products={products} className="mt-8 sm:mt-12" />
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* One line, not a feature grid                                        */}
      {/*                                                                     */}
      {/* This replaced a three-column "How it's made" list of headed         */}
      {/* paragraphs, which is the shape of a SaaS features section and read  */}
      {/* as one wherever it appeared.                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-[88rem] px-5 py-16 sm:px-8 sm:py-24">
          <p className="max-w-[36ch] text-[1.375rem] leading-[1.3] tracking-[-0.02em] sm:text-[2rem]">
            Heavyweight blanks, cut and pressed one piece at a time. Each run is
            a fixed number and we do not reprint.
          </p>
        </div>
      </section>
    </main>
  );
}
