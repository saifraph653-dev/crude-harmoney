import { z } from "zod";

// Mirrors the check in reserve_stock_and_create_order()'s SQL -- the
// database is the real enforcement, this just gives a fast client-side
// bound and a matching error message before the round trip.
export const MAX_QUANTITY_PER_ORDER = 5;

// Messages are written to be shown directly to a customer under the field
// that failed, so they say what to do rather than naming the constraint.
export const checkoutFormSchema = z
  .object({
    variantId: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(MAX_QUANTITY_PER_ORDER),
    email: z
      .string()
      .trim()
      .min(1, "Enter your email so we can send the order confirmation.")
      .max(254, "That email is too long.")
      .email("That doesn't look like a valid email address."),
    shippingName: z
      .string()
      .trim()
      .min(2, "Enter the full name the parcel should be addressed to.")
      .max(200, "That name is too long."),
    shippingAddressLine1: z
      .string()
      .trim()
      .min(5, "Enter a street address we can actually deliver to.")
      .max(300, "That address is too long."),
    shippingAddressLine2: z
      .string()
      .trim()
      .max(300, "That address line is too long.")
      .optional()
      .default(""),
    shippingCity: z
      .string()
      .trim()
      .min(2, "Enter your city.")
      .max(120, "That city name is too long."),
    shippingCountry: z
      .string()
      .trim()
      .min(2, "Enter your country.")
      .max(120, "That country name is too long."),
    shippingPostalCode: z
      .string()
      .trim()
      .max(40, "That postal code is too long.")
      .optional()
      .default(""),
    note: z
      .string()
      .trim()
      .max(500, "Please keep the note under 500 characters.")
      .optional()
      .default(""),
  })
  .strict();

export type CheckoutFormInput = z.infer<typeof checkoutFormSchema>;

/** Names of the fields the customer actually fills in (excludes hidden ones). */
export type CheckoutFieldName =
  | "email"
  | "shippingName"
  | "shippingAddressLine1"
  | "shippingAddressLine2"
  | "shippingCity"
  | "shippingCountry"
  | "shippingPostalCode"
  | "note";

export const CHECKOUT_FIELD_NAMES: CheckoutFieldName[] = [
  "email",
  "shippingName",
  "shippingAddressLine1",
  "shippingAddressLine2",
  "shippingCity",
  "shippingCountry",
  "shippingPostalCode",
  "note",
];

// What the checkout form gets back on a failed attempt. Field errors are
// keyed by input name so each renders against its own field, and the
// submitted values come back so a rejected submission never makes the
// customer retype an address they already entered.
//
// This lives here rather than in app/checkout/actions.ts because that file
// is a "use server" module, and those may only export async functions --
// exporting a plain object from it yields undefined at runtime.
export type CheckoutState = {
  formError: string | null;
  fieldErrors: Partial<Record<CheckoutFieldName, string>>;
  values: Partial<Record<CheckoutFieldName, string>>;
};

export const emptyCheckoutState: CheckoutState = {
  formError: null,
  fieldErrors: {},
  values: {},
};

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
