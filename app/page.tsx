import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { getDropProducts } from "@/lib/products";
import { formatPrice } from "@/lib/format";

// Forced dynamic so the CSP nonce (proxy.ts) reaches this page's script
// tags -- see app/drops/page.tsx for the full explanation.
export const instant = false;

export default async function Home() {
  await connection();
  const products = await getDropProducts();
  const featured = products.filter((p) => p.status === "live").slice(0, 3);

  return (
    <main className="flex flex-1 flex-col">
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 0%, #1d1d22 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <p className="eyebrow">Doha, Qatar</p>
          <h1 className="mt-4 text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Small runs.
            <br />
            <span className="text-accent">No restocks.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Every piece is made in a counted run and then retired. When a size
            sells out it is genuinely gone — we do not reprint.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/drops"
              className="inline-flex h-12 items-center justify-center rounded-full bg-foreground px-7 text-sm font-medium text-background transition-opacity hover:opacity-90 active:opacity-80"
            >
              Shop the collection
            </Link>
            <Link
              href="/orders/lookup"
              className="inline-flex h-12 items-center justify-center rounded-full border border-border-strong px-7 text-sm font-medium text-muted transition-colors hover:border-foreground hover:text-foreground"
            >
              Track an order
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Featured                                                          */}
      {/* ---------------------------------------------------------------- */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              In stock now
            </h2>
            <Link
              href="/drops"
              className="text-sm whitespace-nowrap text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              View all
            </Link>
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-6">
            {featured.map((product) => (
              <li key={product.slug}>
                <Link href={`/drops/${product.slug}`} className="group block">
                  <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface">
                    {product.image ? (
                      <Image
                        src={product.image.path}
                        width={product.image.width}
                        height={product.image.height}
                        alt={product.name}
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : null}
                    {product.collection === "limited" ? (
                      <span className="absolute top-2 left-2 rounded-full bg-accent px-2.5 py-1 text-[0.625rem] font-semibold tracking-wider text-accent-foreground uppercase">
                        Limited
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm font-medium transition-colors group-hover:text-accent">
                    {product.name}
                  </p>
                  {product.fromPriceCents !== null ? (
                    <p className="mt-0.5 text-sm text-subtle">
                      {formatPrice(product.fromPriceCents, product.currency)}
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
