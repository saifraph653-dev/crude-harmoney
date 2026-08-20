import type { CreateCheckoutSessionInput, CreateCheckoutSessionResult, PaymentAdapter } from "./types";

/**
 * Stand-in until the real merchant account (Dibsy or Tap) is approved.
 * Redirects to an internal page instead of a real hosted checkout -- no
 * card entry exists anywhere in this adapter or the page it redirects to.
 * The "simulate a successful payment" action lands with the webhook step,
 * since that's what actually needs to exist for it to do anything.
 */
export class MockPaymentAdapter implements PaymentAdapter {
  readonly providerName = "mock";

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
}
