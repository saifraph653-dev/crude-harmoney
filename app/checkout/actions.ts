"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentAdapter } from "@/lib/payments";
import { getSiteUrl } from "@/lib/site-url";
import { checkoutFormSchema, reservationErrorCode } from "@/lib/checkout";
import { checkRateLimit, checkoutRateLimit, getClientIp } from "@/lib/rate-limit";

export async function submitCheckout(formData: FormData) {
  const headerList = await headers();
  const clientIp = getClientIp((name) => headerList.get(name));
  const rateLimitResult = await checkRateLimit(checkoutRateLimit, clientIp);
  if (!rateLimitResult.allowed) {
    redirect(checkoutRedirect(formData, "rate_limited"));
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
    redirect(checkoutRedirect(formData, "invalid_input"));
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
    redirect(checkoutRedirect(formData, reservationErrorCode(error?.message)));
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
    redirect(checkoutRedirect(formData, "unknown"));
  }

  redirect(session.redirectUrl);
}

function checkoutRedirect(formData: FormData, errorCode: string): string {
  const params = new URLSearchParams({
    variant: String(formData.get("variantId") ?? ""),
    qty: String(formData.get("quantity") ?? "1"),
    error: errorCode,
  });
  return `/checkout?${params.toString()}`;
}
