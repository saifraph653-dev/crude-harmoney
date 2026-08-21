import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductDetailBySlug } from "@/lib/products";
import { ProductBuyBox } from "@/components/ProductBuyBox";

// Forced dynamic (params access is a runtime API) so the CSP nonce
// (proxy.ts) reaches this page's script tags. generateStaticParams and
// the Suspense/ISR-upgrade pattern from before this step no longer apply
// -- with no static shell at all, there's nothing to upgrade. The product
// data itself still comes from getProductDetailBySlug()'s "use cache"
// call, so this still never hits Postgres directly; see SECURITY.md.
export const instant = false;

export default async function ProductPage(props: PageProps<"/drops/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductDetailBySlug(slug);

  if (!product) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/drops" className="text-sm text-zinc-500">
        &larr; All drops
      </Link>
      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
          {product.image ? (
            <Image
              src={product.image.path}
              width={product.image.width}
              height={product.image.height}
              alt={product.name}
              priority
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          {product.status === "ended" ? (
            <p className="mt-1 text-sm text-zinc-500">This drop has ended.</p>
          ) : null}
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {product.description}
          </p>
          <div className="mt-6">
            {product.status === "live" ? (
              <ProductBuyBox variants={product.variants} currency={product.currency} />
            ) : (
              <p className="text-sm text-zinc-500">No longer available.</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
