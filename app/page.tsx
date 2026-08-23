import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { getDropProducts } from "@/lib/products";
import { Wordmark } from "@/components/Wordmark";

// Forced dynamic so the CSP nonce (proxy.ts) reaches this page's script
// tags -- see app/drops/page.tsx for the full explanation.
export const instant = false;

export default async function Home() {
  await connection();
  const products = await getDropProducts();
  const preview = products.slice(0, 3);

  return (
    <main className="flex flex-1 flex-col">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 60% at 50% -10%, #232329 0%, transparent 65%)",
            }}
          />
          <div className="grain absolute inset-0" />
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-5 pt-20 pb-16 text-center sm:px-6 sm:pt-32 sm:pb-24">
          <span className="rule-label">
            <span className="rule" aria-hidden />
            Doha, Qatar
            <span className="rule" aria-hidden />
          </span>

          <h1 className="mt-8 text-[2.75rem] leading-[0.92] font-semibold tracking-[-0.03em] text-balance sm:text-7xl">
            Modern vintage,
            <br />
            <span className="italic">made in small runs.</span>
          </h1>

          <p className="mt-7 max-w-md text-base leading-relaxed text-muted sm:text-lg">
            Heavyweight blanks, hand-pressed marks, counted editions. The first
            drop has not landed yet — this is what is coming.
          </p>

          <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/drops" className="btn-primary">
              See the collection
            </Link>
            <Link href="/orders/lookup" className="btn-ghost">
              Track an order
            </Link>
          </div>

          <p className="mt-6 text-xs tracking-wider text-subtle uppercase">
            Nothing is on sale yet
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Preview strip                                                       */}
      {/* ------------------------------------------------------------------ */}
      {preview.length > 0 ? (
        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-6 sm:py-20">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                First look
              </h2>
              <Link href="/drops" className="link-quiet">
                All pieces
              </Link>
            </div>

            <ul className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6">
              {preview.map((product) => (
                <li key={product.slug}>
                  <Link href={`/drops/${product.slug}`} className="group block">
                    <div className="card-frame">
                      {product.image ? (
                        <Image
                          src={product.image.path}
                          width={product.image.width}
                          height={product.image.height}
                          alt={product.name}
                          sizes="(max-width: 640px) 50vw, 33vw"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm font-medium transition-colors group-hover:text-accent">
                      {product.name}
                    </p>
                    <p className="eyebrow mt-1">
                      {product.collection === "limited" ? "Limited" : "Classic"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* How it's made                                                       */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-6 sm:py-20">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            How it&apos;s made
          </h2>
          <dl className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
            {[
              [
                "Heavyweight blanks",
                "240–260gsm combed cotton, boxy cut, ribbed collar that holds after the wash.",
              ],
              [
                "Pressed by hand",
                "Every mark is cut and heat-pressed one piece at a time. Small variations are the point.",
              ],
              [
                "Counted runs",
                "Each release is a fixed number. When a size goes, it is gone — we do not reprint.",
              ],
            ].map(([title, body]) => (
              <div key={title}>
                <dt className="text-sm font-semibold">{title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted">{body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Closing mark                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-5 py-16 text-center sm:px-6 sm:py-24">
          <Wordmark className="h-8 w-auto text-subtle sm:h-10" />
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-subtle">
            Follow the drop. Once the first run is live it will be here, and it
            will not last long.
          </p>
        </div>
      </section>
    </main>
  );
}
