export type CreateCheckoutSessionInput = {
  orderId: string;
  orderNumber: string;
  amountCents: number;
  currency: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutSessionResult = {
  providerSessionId: string;
  redirectUrl: string;
};

export type WebhookEventKind = "payment_succeeded" | "payment_failed" | "unknown";

export type ParsedWebhookEvent = {
  /** Provider's own unique event id -- the idempotency key. */
  eventId: string;
  eventType: string;
  kind: WebhookEventKind;
  /** Matches CreateCheckoutSessionResult.providerSessionId from checkout. */
  providerSessionId: string;
  amountCents: number;
  currency: string;
};

/**
 * Every payment provider (Dibsy, Tap, ...) implements this. Card entry
 * always happens on the provider's hosted page/SDK/iframe -- this
 * interface only ever carries an amount, a currency, and identifiers, so
 * there is no code path where a card number could pass through it.
 */
export interface PaymentAdapter {
  readonly providerName: string;

  /** HTTP header the webhook signature arrives in, e.g. "Stripe-Signature". */
  readonly webhookSignatureHeader: string;

  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;

  /**
   * Verify BEFORE parsing. Takes the raw, unparsed request body -- JSON.parse
   * first breaks the signature for providers that sign the exact byte
   * sequence (which is most of them).
   */
  verifyWebhookSignature(rawBody: string, signatureHeaderValue: string | null): boolean;

  /** Only ever called after verifyWebhookSignature has returned true. */
  parseWebhookEvent(rawBody: string): ParsedWebhookEvent;
}
