import { z } from "zod";
import { MAX_QUANTITY_PER_ORDER } from "./checkout-constants";

// Server-side only: this module pulls in Zod. Client components must import
// from ./checkout-constants instead -- see the note at the top of that file.
export * from "./checkout-constants";

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

// The bag-driven checkout carries no variant or quantity in the form: the
// lines come from the server-side bag cookie, so the browser cannot name
// its own price or smuggle in a variant the customer never selected. The
// single-variant schema above is retained for the direct
// /checkout?variant=... path.
export const checkoutDetailsSchema = checkoutFormSchema.omit({
  variantId: true,
  quantity: true,
});

