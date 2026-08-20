export type ProductImage = {
  path: string;
  width: number;
  height: number;
};

export type ProductSummary = {
  slug: string;
  name: string;
  status: "live" | "ended";
  image: ProductImage | null;
};

export type VariantSummary = {
  id: string;
  size: string;
  priceCents: number;
};

export type ProductDetail = ProductSummary & {
  description: string;
  currency: string;
  variants: VariantSummary[];
};
