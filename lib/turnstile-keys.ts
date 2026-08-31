// Cloudflare publishes fixed test key pairs that always pass, for local
// development without a Turnstile account (see .env.example). The widget
// they render carries a visible "Testing only — do not use in production"
// banner, which is what customers were being shown on the live order
// lookup because the production environment still holds a test sitekey.
//
// These are documented public constants, not secrets:
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const TEST_SITE_KEYS = new Set([
  "1x00000000000000000000AA", // always passes, visible
  "2x00000000000000000000AB", // always blocks
  "3x00000000000000000000FF", // forces an interactive challenge
]);

const TEST_SECRET_KEYS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

export function isTestSiteKey(key: string | undefined): boolean {
  return !!key && TEST_SITE_KEYS.has(key);
}

export function isTestSecretKey(key: string | undefined): boolean {
  return !!key && TEST_SECRET_KEYS.has(key);
}

/**
 * Whether a real Turnstile challenge should run.
 *
 * Outside development, a test key counts as "not configured". Rendering
 * Cloudflare's testing widget to a customer is worse than not challenging
 * at all: it advertises the site as unfinished, and the key it uses passes
 * every request anyway, so it was never providing protection in the first
 * place. The lookup endpoint stays rate limited either way.
 */
export function turnstileEnabled(siteKey: string | undefined): boolean {
  if (!siteKey) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return !isTestSiteKey(siteKey);
}
