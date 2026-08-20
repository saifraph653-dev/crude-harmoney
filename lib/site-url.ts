/**
 * Absolute origin for URLs handed to a payment provider (successUrl/
 * cancelUrl). Deliberately not derived from the request's Host header --
 * that's client-controlled input and payment providers generally require
 * a fixed, pre-registered domain anyway.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("NEXT_PUBLIC_SITE_URL is not set");
}
