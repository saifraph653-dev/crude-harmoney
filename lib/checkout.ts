import { z } from "zod";

// Mirrors the check in reserve_stock_and_create_order()'s SQL -- the
// database is the real enforcement, this just gives a fast client-side
// bound and a matching error message before the round trip.
export const MAX_QUANTITY_PER_ORDER = 5;

export const checkoutFormSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_ORDER),
    email: z.string().trim().min(1).max(254).email(),
    shippingName: z.string().trim().min(1).max(200),
    shippingAddressLine1: z.string().trim().min(1).max(300),
    shippingAddressLine2: z.string().trim().max(300).optional().default(""),
    shippingCity: z.string().trim().min(1).max(120),
    shippingCountry: z.string().trim().min(1).max(120),
    shippingPostalCode: z.string().trim().max(40).optional().default(""),
    note: z.string().trim().max(500).optional().default(""),
  })
  .strict();

export type CheckoutFormInput = z.infer<typeof checkoutFormSchema>;

const RESERVATION_ERROR_MESSAGES: Record<string, string> = {
  insufficient_stock: "That size just sold out.",
  product_not_live: "This drop isn't live right now.",
  variant_not_found: "That size doesn't exist.",
  invalid_quantity: "Please choose a valid quantity.",
  invalid_input: "Please check your details and try again.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
};

export function mapReservationError(message: string | undefined): string {
  if (message && message in RESERVATION_ERROR_MESSAGES) {
    return RESERVATION_ERROR_MESSAGES[message];
  }
  return "Something went wrong. Please try again.";
}

export function reservationErrorCode(message: string | undefined): string {
  return message && message in RESERVATION_ERROR_MESSAGES ? message : "unknown";
}
