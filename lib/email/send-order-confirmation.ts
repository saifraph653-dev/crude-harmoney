import { Resend } from "resend";
import { buildOrderConfirmationEmail, type OrderConfirmationEmailInput } from "./order-confirmation";

/**
 * Sends the order confirmation email, or logs and no-ops if Resend isn't
 * configured yet -- this keeps local dev and any environment without a
 * Resend account fully functional (checkout/webhook flow still works,
 * customers can still look their order up at /orders/lookup) without a
 * real email account. Throws only on a genuine Resend API error, which
 * the caller decides how to handle (see lib/webhook-processing.ts --
 * a failed email must never undo an already-fulfilled order).
 */
export async function sendOrderConfirmationEmail(order: OrderConfirmationEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.warn(
      `RESEND_API_KEY/RESEND_FROM_EMAIL not set -- skipping confirmation email for ${order.orderNumber}`,
    );
    return;
  }

  const { subject, html, text } = buildOrderConfirmationEmail(order);
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from,
    to: order.email,
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
}
