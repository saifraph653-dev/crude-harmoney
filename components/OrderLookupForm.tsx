"use client";

import { useRef, useState } from "react";
import Script from "next/script";
import { formatPrice } from "@/lib/format";
import type { OrderLookupResult } from "@/lib/dto/order-lookup";

const STATUS_LABELS: Record<string, string> = {
  pending: "Payment pending",
  paid: "Paid -- preparing your order",
  fulfilled: "Shipped",
  cancelled: "Cancelled",
  expired: "Expired (payment was never completed)",
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: { sitekey: string; callback: (token: string) => void },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export function OrderLookupForm({
  nonce,
  turnstileSiteKey,
}: {
  nonce: string | null;
  turnstileSiteKey: string;
}) {
  const [result, setResult] = useState<OrderLookupResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  function renderTurnstile() {
    if (!turnstileContainerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: setTurnstileToken,
    });
  }

  // Empty sitekey means Turnstile is not configured for this environment;
  // the lookup still works and is still rate limited server-side.
  const captchaRequired = turnstileSiteKey !== "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (captchaRequired && !turnstileToken) return;

    setSubmitting(true);
    setResult(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: formData.get("orderNumber"),
          email: formData.get("email"),
          turnstileToken: turnstileToken ?? "",
        }),
      });
      const body = (await res.json()) as OrderLookupResult;
      setResult(body);
    } catch {
      setResult({ found: false });
    } finally {
      setSubmitting(false);
      // Turnstile tokens are single-use -- reset for a possible second lookup.
      setTurnstileToken(null);
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.reset(widgetIdRef.current);
      }
    }
  }

  return (
    <div>
{captchaRequired ? (
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        nonce={nonce ?? undefined}
        onLoad={renderTurnstile}
      />
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="orderNumber">
            Order number
          </label>
          <input
            id="orderNumber"
            name="orderNumber"
            placeholder="CH-000123"
            required
            maxLength={20}
            className="mt-1 h-12 w-full rounded-[2px] border border-border-strong bg-surface px-3 text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="email">
            Email used at checkout
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
            className="mt-1 h-12 w-full rounded-[2px] border border-border-strong bg-surface px-3 text-base"
          />
        </div>
        {captchaRequired ? <div ref={turnstileContainerRef} /> : null}
        <button
          type="submit"
          disabled={submitting || (captchaRequired && !turnstileToken)}
          className="btn-primary w-full disabled:opacity-50"
        >
          {submitting ? "Looking up…" : "Find my order"}
        </button>
      </form>

      {result && !result.found ? (
        <p className="mt-6 text-sm text-muted">
          No matching order found. Double-check the order number and the email you
          used at checkout.
        </p>
      ) : null}

      {result && result.found ? (
        <div className="mt-6 space-y-4 border-t border-border pt-6 text-sm">
          <div className="flex justify-between">
            <span className="font-medium">{result.orderNumber}</span>
            <span>{STATUS_LABELS[result.status] ?? result.status}</span>
          </div>
          <ul className="space-y-1">
            {result.items.map((item, i) => (
              <li key={i} className="flex justify-between text-muted">
                <span>
                  {item.productName} ({item.size}) &times;{item.quantity}
                </span>
                <span>{formatPrice(item.unitPriceCents * item.quantity, result.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between font-medium">
            <span>Total</span>
            <span>{formatPrice(result.totalCents, result.currency)}</span>
          </div>
          <div className="text-muted">
            Shipping to {result.shipping.name}, {result.shipping.addressLine1}
            {result.shipping.addressLine2 ? `, ${result.shipping.addressLine2}` : ""},{" "}
            {result.shipping.city}, {result.shipping.country}
          </div>
        </div>
      ) : null}
    </div>
  );
}
