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
  title: "Drops",
  description: "The Classic range and current Limited editions.",
};

export default async function DropsPage() {
  await connection();
  const products = await getDropProducts();

  const limited = products.filter((p) => p.collection === "limited");
  const classic = products.filter((p) => p.collection === "classic");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Drops</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
          The Classic range is always in rotation. Limited editions are numbered,
          made once, and never reprinted.
        </p>
      </header>

      {products.length === 0 ? (
        <p className="mt-16 text-muted">Nothing live right now. Check back soon.</p>
      ) : (
        <div className="mt-10 space-y-14 sm:mt-14 sm:space-y-20">
          {limited.length > 0 ? (
            <section>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Limited Edition
                </h2>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[0.625rem] font-semibold tracking-wider text-accent-foreground uppercase">
                  {limited.length} live
                </span>
              </div>
              <p className="mt-2 text-sm text-subtle">
                Numbered runs. Once a size is gone it is not coming back.
              </p>
              <ProductGrid products={limited} className="mt-6" />
            </section>
          ) : null}

          {classic.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Classic Collection
              </h2>
              <p className="mt-2 text-sm text-subtle">
                The core range. Restocked between drops.
              </p>
              <ProductGrid products={classic} className="mt-6" />
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
