export type ProductImage = {
  path: string;
  width: number;
  height: number;
};

export type Collection = "classic" | "limited";

export type ProductSummary = {
  slug: string;
  name: string;
  status: "live" | "ended";
  collection: Collection;
  image: ProductImage | null;
  /** Lowest variant price, for the "from QAR X" label on grid cards. */
  fromPriceCents: number | null;
  currency: string;
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
