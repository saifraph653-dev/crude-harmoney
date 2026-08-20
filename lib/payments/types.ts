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

/**
 * Every payment provider (Dibsy, Tap, ...) implements this. Card entry
 * always happens on the provider's hosted page/SDK/iframe -- this
 * interface only ever carries an amount, a currency, and identifiers, so
 * there is no code path where a card number could pass through it.
 */
export interface PaymentAdapter {
  readonly providerName: string;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;
}
