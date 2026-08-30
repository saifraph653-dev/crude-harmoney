import { formatPrice } from "@/lib/format";

export type OrderConfirmationEmailInput = {
  orderNumber: string;
  email: string;
  items: { productName: string; size: string; quantity: number; unitPriceCents: number }[];
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildOrderConfirmationEmail(order: OrderConfirmationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order confirmed -- ${order.orderNumber}`;

  const itemLines = order.items.map(
    (item) =>
      `${item.productName} (${item.size}) x${item.quantity} -- ${formatPrice(item.unitPriceCents * item.quantity, order.currency)}`,
  );

  const addressLines = [
    order.shipping.name,
    order.shipping.addressLine1,
    order.shipping.addressLine2,
    [order.shipping.city, order.shipping.postalCode].filter(Boolean).join(" "),
    order.shipping.country,
  ].filter(Boolean);

  const text = [
    `Order ${order.orderNumber} is confirmed.`,
    "",
    "Items:",
    ...itemLines.map((l) => `- ${l}`),
    "",
    `Total: ${formatPrice(order.totalCents, order.currency)}`,
    "",
    "Shipping to:",
    ...addressLines,
    "",
    `Track this order any time at ${orderLookupUrl()} with your order number and email.`,
  ].join("\n");

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #18181b;">
      <h1 style="font-size: 18px;">Order ${escapeHtml(order.orderNumber)} is confirmed</h1>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        ${order.items
          .map(
            (item) => `
          <tr>
            <td style="padding: 4px 0;">${escapeHtml(item.productName)} (${escapeHtml(item.size)}) &times;${item.quantity}</td>
            <td style="padding: 4px 0; text-align: right;">${escapeHtml(formatPrice(item.unitPriceCents * item.quantity, order.currency))}</td>
          </tr>`,
          )
          .join("")}
        <tr style="font-weight: 600; border-top: 1px solid #e4e4e7;">
          <td style="padding: 8px 0;">Total</td>
          <td style="padding: 8px 0; text-align: right;">${escapeHtml(formatPrice(order.totalCents, order.currency))}</td>
        </tr>
      </table>
      <p style="font-size: 14px; color: #71717a;">
        Shipping to:<br />
        ${addressLines.map(escapeHtml).join("<br />")}
      </p>
      <p style="font-size: 13px; color: #a1a1aa;">
        Track this order any time at <a href="${escapeHtml(orderLookupUrl())}">${escapeHtml(orderLookupUrl())}</a>
        with your order number and email.
      </p>
    </div>
  `.trim();

  return { subject, html, text };
}

function orderLookupUrl(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${site.replace(/\/$/, "")}/orders/lookup`;
}
