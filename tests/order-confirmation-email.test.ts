import { describe, expect, it } from "vitest";
import { buildOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import { formatPrice } from "@/lib/format";

describe("buildOrderConfirmationEmail", () => {
  const baseOrder = {
    orderNumber: "CH-000123",
    email: "buyer@example.com",
    items: [{ productName: "Midnight Hoodie", size: "M", quantity: 2, unitPriceCents: 28000 }],
    totalCents: 56000,
    currency: "QAR",
    shipping: {
      name: "A Buyer",
      addressLine1: "123 Main St",
      addressLine2: "",
      city: "Doha",
      country: "Qatar",
      postalCode: "",
    },
  };

  it("includes the order number, item, and total in all three formats", () => {
    const { subject, html, text } = buildOrderConfirmationEmail(baseOrder);
    expect(subject).toContain("CH-000123");
    for (const body of [html, text]) {
      expect(body).toContain("Midnight Hoodie");
      expect(body).toContain(formatPrice(56000, "QAR"));
    }
  });

  it("escapes HTML-unsafe characters in free-text fields (shipping name/address)", () => {
    const { html } = buildOrderConfirmationEmail({
      ...baseOrder,
      shipping: { ...baseOrder.shipping, name: '<script>alert("x")</script>' },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
