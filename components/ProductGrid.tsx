import Image from "next/image";
import Link from "next/link";
import type { ProductSummary } from "@/lib/dto/products";
import { formatPrice } from "@/lib/format";

// Server component: pure presentation over an already-fetched DTO, so it
// stays out of the client bundle and adds nothing to the critical path.
export function ProductGrid({
  products,
  className = "",
}: {
  products: ProductSummary[];
  className?: string;
}) {
  return (
    <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 ${className}`}>
      {products.map((product) => {
        const ended = product.status === "ended";
        return (
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
                    className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] ${
                      ended ? "opacity-40 grayscale" : ""
                    }`}
                  />
                ) : null}

                {product.collection === "limited" && !ended ? (
                  <span className="absolute top-2 left-2 rounded-full bg-accent px-2.5 py-1 text-[0.625rem] font-semibold tracking-wider text-accent-foreground uppercase">
                    Limited
                  </span>
                ) : null}

                {ended ? (
                  <span className="absolute top-2 left-2 rounded-full border border-border-strong bg-background/80 px-2.5 py-1 text-[0.625rem] font-semibold tracking-wider text-muted uppercase">
                    Sold out
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm font-medium transition-colors group-hover:text-accent">
                {product.name}
              </p>
              {product.fromPriceCents !== null ? (
                <p className="mt-0.5 text-sm text-subtle">
                  {ended ? "—" : formatPrice(product.fromPriceCents, product.currency)}
                </p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
