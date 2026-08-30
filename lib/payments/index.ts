import type { PaymentAdapter } from "./types";
import { MockPaymentAdapter } from "./mock-adapter";

/**
 * The one place that picks which provider is live. Swap MockPaymentAdapter
 * for DibsyAdapter/TapAdapter here once the merchant account is approved --
 * this should be the only file that needs to change.
 */
export function getPaymentAdapter(): PaymentAdapter {
  return new MockPaymentAdapter();
}

export type {
  PaymentAdapter,
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  ParsedWebhookEvent,
  WebhookEventKind,
} from "./types";
