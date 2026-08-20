export type OrderLookupItem = {
  productName: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderLookupResult =
  | { found: false }
  | {
      found: true;
      orderNumber: string;
      status: string;
      createdAt: string;
      items: OrderLookupItem[];
      subtotalCents: number;
      totalCents: number;
      currency: string;
      shipping: {
        name: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        country: string;
        postalCode: string;
      };
    };
