import { afterEach, describe, expect, it } from "vitest";
import { verifyTurnstileToken } from "@/lib/turnstile";

// Hits the real Cloudflare siteverify endpoint with Cloudflare's own
// published test key pairs (not mocked) -- see
// https://developers.cloudflare.com/turnstile/troubleshooting/testing/.
// Requires network access to challenges.cloudflare.com.

const ALWAYS_PASSES_SECRET = "1x0000000000000000000000000000000AA";
const ALWAYS_FAILS_SECRET = "2x0000000000000000000000000000000AA";

describe("verifyTurnstileToken", () => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;

  afterEach(() => {
    process.env.TURNSTILE_SECRET_KEY = originalSecret;
  });

  it("succeeds against Cloudflare's real 'always passes' test secret", async () => {
    process.env.TURNSTILE_SECRET_KEY = ALWAYS_PASSES_SECRET;
    const result = await verifyTurnstileToken("any-token-value", "203.0.113.1");
    expect(result).toBe(true);
  });

  it("fails against Cloudflare's real 'always fails' test secret", async () => {
    process.env.TURNSTILE_SECRET_KEY = ALWAYS_FAILS_SECRET;
    const result = await verifyTurnstileToken("any-token-value", "203.0.113.1");
    expect(result).toBe(false);
  });

  it("fails closed when no token is provided", async () => {
    process.env.TURNSTILE_SECRET_KEY = ALWAYS_PASSES_SECRET;
    const result = await verifyTurnstileToken(null, "203.0.113.1");
    expect(result).toBe(false);
  });

  it("fails closed when no secret is configured", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const result = await verifyTurnstileToken("any-token-value", "203.0.113.1");
    expect(result).toBe(false);
  });
});
