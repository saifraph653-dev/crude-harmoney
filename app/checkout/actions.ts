"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentAdapter } from "@/lib/payments";
import { getSiteUrl } from "@/lib/site-url";
import {
  checkoutFormSchema,
  mapReservationError,
  reservationErrorCode,
  CHECKOUT_FIELD_NAMES,
  type CheckoutFieldName,
  type CheckoutState,
} from "@/lib/checkout";
import { checkRateLimit, checkoutRateLimit, getClientIp } from "@/lib/rate-limit";

function readValues(formData: FormData): CheckoutState["values"] {
  const values: CheckoutState["values"] = {};
  for (const name of CHECKOUT_FIELD_NAMES) {
    const raw = formData.get(name);
    if (typeof raw === "string") values[name] = raw;
  }
  return values;
}

export async function submitCheckout(
  _prevState: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const values = readValues(formData);

  const headerList = await headers();
  const clientIp = getClientIp((name) => headerList.get(name));
  const rateLimitResult = await checkRateLimit(checkoutRateLimit, clientIp);
  if (!rateLimitResult.allowed) {
    return { formError: mapReservationError("rate_limited"), fieldErrors: {}, values };
  }

  const parsed = checkoutFormSchema.safeParse({
    variantId: formData.get("variantId"),
    quantity: formData.get("quantity"),
    email: formData.get("email"),
    shippingName: formData.get("shippingName"),
    shippingAddressLine1: formData.get("shippingAddressLine1"),
    shippingAddressLine2: formData.get("shippingAddressLine2"),
    shippingCity: formData.get("shippingCity"),
    shippingCountry: formData.get("shippingCountry"),
    shippingPostalCode: formData.get("shippingPostalCode"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    // Surface zod's per-field messages against the fields themselves,
    // rather than collapsing everything into one generic banner.
    const fieldErrors: CheckoutState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && (CHECKOUT_FIELD_NAMES as string[]).includes(key)) {
        const name = key as CheckoutFieldName;
        fieldErrors[name] ??= issue.message;
      }
    }
    const hasFieldErrors = Object.keys(fieldErrors).length > 0;
    return {
      // If the only problems are in hidden fields (variantId/quantity),
      // there's no field to point at -- fall back to the banner.
      formError: hasFieldErrors ? null : mapReservationError("invalid_input"),
      fieldErrors,
      values,
    };
  }

  const input = parsed.data;
  const admin = createAdminClient();

  // The database is the only source of truth on whether this succeeds --
  // see reserve_stock_and_create_order() in supabase/migrations. Every
  // field below is server-validated input, never a client-supplied price
  // or total.
  const { data, error } = await admin.rpc("reserve_stock_and_create_order", {
    p_variant_id: input.variantId,
    p_quantity: input.quantity,
    p_email: input.email,
    p_shipping_name: input.shippingName,
    p_shipping_address_line1: input.shippingAddressLine1,
    p_shipping_address_line2: input.shippingAddressLine2,
    p_shipping_city: input.shippingCity,
    p_shipping_country: input.shippingCountry,
    p_shipping_postal_code: input.shippingPostalCode,
    p_note: input.note,
  });

  if (error || !data || data.length === 0) {
    return {
      formError: mapReservationError(reservationErrorCode(error?.message)),
      fieldErrors: {},
      values,
    };
  }

  const order = data[0];
  const origin = getSiteUrl();
  const adapter = getPaymentAdapter();

  const session = await adapter.createCheckoutSession({
    orderId: order.order_id,
    orderNumber: order.order_number,
    amountCents: order.total_cents,
    currency: order.currency,
    customerEmail: input.email,
    successUrl: `${origin}/checkout/success?order=${encodeURIComponent(order.order_number)}`,
    cancelUrl: `${origin}/checkout/cancelled?order=${encodeURIComponent(order.order_number)}`,
  });

  const { error: updateError } = await admin
    .from("orders")
    .update({
      payment_provider: adapter.providerName,
      payment_provider_session_id: session.providerSessionId,
    })
    .eq("id", order.order_id);

  if (updateError) {
    // The reservation and order already exist and will simply expire in
    // 10 minutes if the customer can't proceed -- fail loud rather than
    // silently sending them to a payment page the order can't be matched
    // back to later.
    return { formError: mapReservationError("unknown"), fieldErrors: {}, values };
  }

  redirect(session.redirectUrl);
}
