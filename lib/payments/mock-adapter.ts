import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  ParsedWebhookEvent,
  PaymentAdapter,
} from "./types";

type MockWebhookPayload = {
  eventId: string;
  eventType: "payment.succeeded" | "payment.failed";
  providerSessionId: string;
  amountCents: number;
  currency: string;
};

function getSharedSecret(): string {
  const secret = process.env.PAYMENT_MOCK_WEBHOOK_SECRET;
  if (!secret) throw new Error("PAYMENT_MOCK_WEBHOOK_SECRET is not set");
  return secret;
}

/** Exported so tests (and, in dev, a documented curl recipe) can sign a payload the same way this adapter verifies it. */
export function signMockWebhookPayload(rawBody: string): string {
  return createHmac("sha256", getSharedSecret()).update(rawBody).digest("hex");
}

/**
 * Stand-in until the real merchant account (Dibsy or Tap) is approved.
 * Redirects to an internal page instead of a real hosted checkout -- no
 * card entry exists anywhere in this adapter or the page it redirects to.
 *
 * The webhook signature scheme here (HMAC-SHA256 hex digest of the raw
 * body, shared-secret) is a stand-in for whatever scheme the real
 * provider uses -- the point being proven is "verify signature before
 * parsing body," which is provider-agnostic.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  readonly providerName = "mock";
  readonly webhookSignatureHeader = "x-mock-signature";

  async createCheckoutSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CreateCheckoutSessionResult> {
    const providerSessionId = `mock_${input.orderId}`;
    const params = new URLSearchParams({
      orderNumber: input.orderNumber,
      amountCents: String(input.amountCents),
      currency: input.currency,
    });

    return {
      providerSessionId,
      redirectUrl: `/checkout/mock/${providerSessionId}?${params.toString()}`,
    };
  }

  verifyWebhookSignature(rawBody: string, signatureHeaderValue: string | null): boolean {
    if (!signatureHeaderValue) return false;

    const expected = signMockWebhookPayload(rawBody);
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signatureHeaderValue, "hex");

    // timingSafeEqual throws on length mismatch rather than returning false.
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }

  parseWebhookEvent(rawBody: string): ParsedWebhookEvent {
    const payload = JSON.parse(rawBody) as MockWebhookPayload;

    if (
      typeof payload.eventId !== "string" ||
      typeof payload.providerSessionId !== "string" ||
      typeof payload.amountCents !== "number" ||
      typeof payload.currency !== "string"
    ) {
      throw new Error("malformed mock webhook payload");
    }

    return {
      eventId: payload.eventId,
      eventType: payload.eventType,
      kind:
        payload.eventType === "payment.succeeded"
          ? "payment_succeeded"
          : payload.eventType === "payment.failed"
            ? "payment_failed"
            : "unknown",
      providerSessionId: payload.providerSessionId,
      amountCents: payload.amountCents,
      currency: payload.currency,
    };
  }
}
