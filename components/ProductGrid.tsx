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
        const upcoming = product.status === "coming_soon";
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
                    sizes="(max-width: 640px) 50vw, 33vw"
                    className={`h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] ${
                      ended ? "opacity-40 grayscale" : ""
                    }`}
                  />
                ) : null}

                {product.collection === "limited" && !ended ? (
                  <span className="absolute top-2.5 left-2.5 rounded-[2px] bg-accent px-2.5 py-1 text-[0.625rem] font-semibold tracking-wider text-accent-foreground uppercase">
                    Limited
                  </span>
                ) : null}

                {ended ? (
                  <span className="absolute top-2.5 left-2.5 rounded-[2px] border border-border-strong bg-background/85 px-2.5 py-1 text-[0.625rem] font-semibold tracking-wider text-muted uppercase">
                    Sold out
                  </span>
                ) : null}
              </div>

              <p className="mt-3 text-sm font-medium transition-colors group-hover:text-accent">
                {product.name}
              </p>

              {/* Before launch we show the intended price but never imply it
                  can be bought right now. */}
              {upcoming ? (
                <p className="eyebrow mt-1">Coming soon</p>
              ) : ended ? (
                <p className="mt-0.5 text-sm text-subtle">—</p>
              ) : product.fromPriceCents !== null ? (
                <p className="mt-0.5 text-sm text-subtle">
                  {formatPrice(product.fromPriceCents, product.currency)}
                </p>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
