import Image from "next/image";
import { getSiteUrl } from "@/lib/site-url";
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

  const url = `${getSiteUrl()}/drops/${product.slug}`;
  const description = product.description.slice(0, 160);

  return {
    title: product.name,
    description,
    // Canonical so the drop page has one address even when it is reached
    // with tracking parameters on the end of an Instagram link.
    alternates: { canonical: url },
    openGraph: {
      title: `${product.name} · Crude Harmony`,
      description,
      url,
      type: "website",
      images: product.image
        ? [{ url: product.image.path, width: product.image.width, height: product.image.height, alt: product.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} · Crude Harmony`,
      description,
      images: product.image ? [product.image.path] : undefined,
    },
  };
}

export default async function ProductPage(props: PageProps<"/drops/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductDetailBySlug(slug);

  if (!product) notFound();

  const isLimited = product.collection === "limited";
  const ended = product.status === "ended";
  const upcoming = product.status === "coming_soon";

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6 sm:py-12">
      <Link
        href="/drops"
        className="inline-flex items-center gap-1.5 text-sm text-subtle transition-colors hover:text-foreground"
      >
        <span aria-hidden>&larr;</span> The collection
      </Link>

      <div className="mt-5 grid gap-9 sm:mt-8 sm:grid-cols-2 sm:gap-14">
        {/* Image */}
        <div className="card-frame !rounded-[2px]">
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
            <span className="absolute top-3 left-3 rounded-[2px] bg-accent px-3 py-1.5 text-[0.625rem] font-semibold tracking-wider text-accent-foreground uppercase">
              Limited Edition
            </span>
          ) : null}
        </div>

        {/* Details */}
        <div className="flex flex-col">
          <span className="eyebrow">
            {isLimited ? "Limited Edition" : "Classic Collection"}
          </span>
          <h1 className="display mt-2.5 text-[2rem] sm:text-[2.75rem]">
            {product.name}
          </h1>

          {product.fromPriceCents !== null && !ended ? (
            <p className="mt-3 text-xl font-medium sm:text-2xl">
              {formatPrice(product.fromPriceCents, product.currency)}
              {upcoming ? (
                <span className="ml-2 align-middle text-sm font-normal text-subtle">
                  at launch
                </span>
              ) : null}
            </p>
          ) : null}

          {ended ? (
            <p className="mt-3 inline-flex w-fit rounded-[2px] border border-border-strong px-3 py-1 text-xs text-muted">
              This drop has ended
            </p>
          ) : null}

          <p className="mt-6 text-sm leading-relaxed text-muted">
            {product.description}
          </p>

          <div className="mt-8">
            {product.status === "live" ? (
              <ProductBuyBox variants={product.variants} currency={product.currency} />
            ) : upcoming ? (
              <div className="rounded-[2px] border border-border bg-surface p-5">
                <p className="text-sm font-medium">Not released yet</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  This piece is part of the first drop. Sizes and stock go live on
                  launch day — nothing can be ordered before then.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <li
                      key={v.id}
                      className="rounded-[2px] border border-border-strong px-3 py-1.5 text-xs text-subtle"
                    >
                      {v.size}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-subtle">No longer available.</p>
            )}
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-7 text-sm">
            <div>
              <dt className="eyebrow">Fabric</dt>
              <dd className="mt-1.5 text-muted">
                {isLimited ? "260gsm combed cotton" : "240gsm combed cotton"}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Print</dt>
              <dd className="mt-1.5 text-muted">Hand-pressed vinyl</dd>
            </div>
            <div>
              <dt className="eyebrow">Shipping</dt>
              <dd className="mt-1.5 text-muted">From Doha, 2–4 days</dd>
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
