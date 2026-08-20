import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLiveProductSlugs, getProductDetailBySlug } from "@/lib/products";
import { ProductBuyBox } from "@/components/ProductBuyBox";

export async function generateStaticParams() {
  const slugs = await getLiveProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export default function ProductPage(props: PageProps<"/drops/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductDetail params={props.params} />
    </Suspense>
  );
}

async function ProductDetail({
  params,
}: Pick<PageProps<"/drops/[slug]">, "params">) {
  const { slug } = await params;
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

function ProductSkeleton() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mt-4 grid gap-8 sm:grid-cols-2">
        <div className="aspect-square animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        <div className="space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-4 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </main>
  );
}
