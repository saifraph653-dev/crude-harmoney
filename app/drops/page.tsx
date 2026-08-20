import Image from "next/image";
import Link from "next/link";
import { getDropProducts } from "@/lib/products";

export default async function DropsPage() {
  const products = await getDropProducts();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold">Drops</h1>
      {products.length === 0 ? (
        <p className="text-zinc-500">Nothing live right now. Check back soon.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          {products.map((product) => (
            <li key={product.slug}>
              <Link href={`/drops/${product.slug}`} className="group block">
                <div className="aspect-square overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
                  {product.image ? (
                    <Image
                      src={product.image.path}
                      width={product.image.width}
                      height={product.image.height}
                      alt={product.name}
                      className="h-full w-full object-cover transition group-hover:opacity-90"
                    />
                  ) : null}
                </div>
                <p className="mt-2 text-sm font-medium">{product.name}</p>
                {product.status === "ended" ? (
                  <p className="text-xs text-zinc-500">Ended</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
