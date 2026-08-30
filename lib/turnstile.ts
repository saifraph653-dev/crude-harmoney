import "server-only";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile token server-side. No graceful "skip if
 * unconfigured" fallback here (unlike Resend/Upstash) -- Cloudflare
 * publishes real, live test key pairs specifically for local dev/testing
 * without a real site (see .env.example), so there's no scenario where
 * this needs to no-op: local dev uses the "always passes" test pair,
 * production uses real keys. An empty/missing secret is treated as
 * verification failure, not skipped.
 */
export async function verifyTurnstileToken(
  token: string | null,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const result = (await res.json()) as { success: boolean };
    return result.success === true;
  } catch {
    // Network failure talking to Cloudflare -- fail closed, same as any
    // other verification failure.
    return false;
  }
}
