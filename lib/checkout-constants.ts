// Zod-free half of the checkout module.
//
// This exists because of a bundle problem, not for tidiness.
// ProductBuyBox and CheckoutForm are client components and each needed one
// or two plain values from lib/checkout.ts -- an integer ceiling, a list of
// field names, an empty state object. That module defines the checkout
// schema at its top level, so importing a single constant from it pulled
// all of Zod into the browser bundle: a 278 KB chunk on the two pages that
// matter most for actually selling anything.
//
// Values here must stay dependency-free. Anything needing Zod belongs in
// lib/checkout.ts, which is server-side only.

// Mirrors the check in the reservation functions' SQL -- the database is
// the real enforcement, this just gives a fast client-side bound and a
// matching error message before the round trip.
export const MAX_QUANTITY_PER_ORDER = 5;

/** Names of the fields the customer actually fills in. */
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
