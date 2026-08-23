import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductDetailBySlug } from "@/lib/products";
import { ProductBuyBox } from "@/components/ProductBuyBox";
import { formatPrice } from "@/lib/format";

// Forced dynamic (params access is a runtime API) so the CSP nonce
// (proxy.ts) reaches this page's script tags. generateStaticParams and
// the Suspense/ISR-upgrade pattern from before this step no longer apply
// -- with no static shell at all, there's nothing to upgrade. The product
// data itself still comes from getProductDetailBySlug()'s "use cache"
// call, so this still never hits Postgres directly; see SECURITY.md.
export const instant = false;

export async function generateMetadata(
  props: PageProps<"/drops/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductDetailBySlug(slug);
  if (!product) return { title: "Not found" };
  return {
    title: product.name,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage(props: PageProps<"/drops/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductDetailBySlug(slug);

  if (!product) notFound();

  const isLimited = product.collection === "limited";
  const ended = product.status === "ended";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-12">
      <Link
        href="/drops"
        className="inline-flex items-center gap-1.5 text-sm text-subtle transition-colors hover:text-foreground"
      >
        <span aria-hidden>&larr;</span> All drops
      </Link>

      <div className="mt-5 grid gap-8 sm:mt-8 sm:grid-cols-2 sm:gap-12">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-surface">
          {product.image ? (
            <Image
              src={product.image.path}
              width={product.image.width}
              height={product.image.height}
              alt={product.name}
              priority
              sizes="(max-width: 640px) 100vw, 50vw"
              className={`h-full w-full object-cover ${ended ? "opacity-40 grayscale" : ""}`}
            />
          ) : null}
          {isLimited && !ended ? (
            <span className="absolute top-3 left-3 rounded-full bg-accent px-3 py-1.5 text-[0.625rem] font-semibold tracking-wider text-accent-foreground uppercase">
              Limited Edition
            </span>
          ) : null}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <p className="eyebrow">
            {isLimited ? "Limited Edition" : "Classic Collection"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {product.name}
          </h1>

          {product.fromPriceCents !== null && !ended ? (
            <p className="mt-3 text-xl font-medium sm:text-2xl">
              {formatPrice(product.fromPriceCents, product.currency)}
            </p>
          ) : null}

          {ended ? (
            <p className="mt-3 inline-flex w-fit rounded-full border border-border-strong px-3 py-1 text-xs text-muted">
              This drop has ended
            </p>
          ) : null}

          <p className="mt-5 text-sm leading-relaxed text-muted">
            {product.description}
          </p>

          <div className="mt-7">
            {product.status === "live" ? (
              <ProductBuyBox variants={product.variants} currency={product.currency} />
            ) : (
              <p className="text-sm text-subtle">No longer available.</p>
            )}
          </div>

          <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-6 text-sm">
            <div>
              <dt className="eyebrow">Shipping</dt>
              <dd className="mt-1.5 text-muted">Ships from Doha in 2–4 days</dd>
            </div>
            <div>
              <dt className="eyebrow">Restock</dt>
              <dd className="mt-1.5 text-muted">
                {isLimited ? "Never — numbered run" : "Between drops"}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}
