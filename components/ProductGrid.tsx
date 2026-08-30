import Image from "next/image";
import Link from "next/link";
import type { ProductSummary } from "@/lib/dto/products";
import { formatPrice } from "@/lib/format";

// Server component: pure presentation over an already-fetched DTO, so it
// stays out of the client bundle and adds nothing to the critical path.
//
// Two columns on phones, three from tablet up. The card carries the piece,
// its price, and nothing else: the previous version printed a "CLASSIC"
// eyebrow under every product, which is the same word six times and tells a
// customer nothing, and showed no price at all. "Coming soon" is stated once
// for the drop rather than repeated under every card for the same reason.
export function ProductGrid({
  products,
  className = "",
}: {
  products: ProductSummary[];
  className?: string;
}) {
  return (
    <ul className={`grid grid-cols-2 gap-x-3 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-16 ${className}`}>
      {products.map((product, i) => {
        const ended = product.status === "ended";
        return (
          <li key={product.slug}>
            <Link href={`/drops/${product.slug}`} className="group block">
              <div className="card-frame">
                {product.image ? (
                  <Image
                    src={product.image.path}
                    width={product.image.width}
                    height={product.image.height}
                    alt={product.name}
                    // Two-up on phones, three-up above: a 390px phone asks
                    // for ~190px, not a desktop crop.
                    sizes="(max-width: 640px) 47vw, (max-width: 1024px) 31vw, 29vw"
                    // Only the first row is above the fold anywhere.
                    loading={i < 2 ? "eager" : "lazy"}
                    className={`h-full w-full object-cover transition-opacity duration-500 group-hover:opacity-90 ${
                      ended ? "opacity-40 grayscale" : ""
                    }`}
                  />
                ) : null}

                {ended ? (
                  <span className="absolute top-0 left-0 bg-background px-2 py-1 text-[0.625rem] font-medium tracking-[0.16em] text-muted uppercase">
                    Sold out
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-medium">{product.name}</p>
                {!ended && product.fromPriceCents !== null ? (
                  <p className="shrink-0 text-sm text-muted">
                    {formatPrice(product.fromPriceCents, product.currency)}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
