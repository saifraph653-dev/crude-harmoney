import { connection } from "next/server";
import type { Metadata } from "next";
import { getDropProducts } from "@/lib/products";
import { ProductGrid } from "@/components/ProductGrid";

// Forced dynamic (connection()) so the CSP nonce (proxy.ts) actually
// reaches this page's script tags -- nonces only get injected during
// per-request SSR, never into a build-time static shell. The data itself
// still comes from getDropProducts()'s "use cache" call, so this still
// never hits Postgres directly; see SECURITY.md and next.config.ts.
export const instant = false;

export const metadata: Metadata = {
  title: "The Collection",
  description: "The Classic range and the first Limited editions. Not yet released.",
};

export default async function DropsPage() {
  await connection();
  const products = await getDropProducts();

  const limited = products.filter((p) => p.collection === "limited");
  const classic = products.filter((p) => p.collection === "classic");
  const anyUpcoming = products.some((p) => p.status === "coming_soon");

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-6 sm:py-18">
      <header className="max-w-xl">
        <span className="eyebrow">The collection</span>
        <h1 className="mt-3 text-3xl leading-[1.05] font-semibold tracking-[-0.02em] sm:text-5xl">
          Six pieces.
          <br />
          <span className="italic">Two of them numbered.</span>
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-muted sm:text-base">
          The Classic range stays in rotation between drops. Limited editions are
          made once, numbered, and never reprinted.
        </p>

        {anyUpcoming ? (
          <p className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-border-strong bg-surface px-4 py-2.5 text-sm text-muted">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
            />
            Not released yet — nothing here can be bought today.
          </p>
        ) : null}
      </header>

      {products.length === 0 ? (
        <p className="mt-16 text-muted">Nothing to show yet. Check back soon.</p>
      ) : (
        <div className="mt-12 space-y-16 sm:mt-16 sm:space-y-24">
          {limited.length > 0 ? (
            <section>
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Limited Edition
                </h2>
                <span className="eyebrow">{limited.length} pieces</span>
              </div>
              <p className="mt-2 max-w-md text-sm text-subtle">
                Numbered runs. Once a size is gone it is not coming back.
              </p>
              <ProductGrid products={limited} className="mt-7" />
            </section>
          ) : null}

          {classic.length > 0 ? (
            <section>
              <div className="flex items-baseline gap-3">
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Classic Collection
                </h2>
                <span className="eyebrow">{classic.length} pieces</span>
              </div>
              <p className="mt-2 max-w-md text-sm text-subtle">
                The core range. Restocked between drops.
              </p>
              <ProductGrid products={classic} className="mt-7" />
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
