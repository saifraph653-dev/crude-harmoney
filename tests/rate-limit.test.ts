import { describe, expect, it } from "vitest";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

describe("getClientIp", () => {
  it("prefers the first IP in x-forwarded-for", () => {
    const headers: Record<string, string> = {
      "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2",
    };
    expect(getClientIp((name) => headers[name] ?? null)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers: Record<string, string> = { "x-real-ip": "198.51.100.7" };
    expect(getClientIp((name) => headers[name] ?? null)).toBe("198.51.100.7");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    expect(getClientIp(() => null)).toBe("unknown");
  });
});

describe("checkRateLimit", () => {
  // .env.local intentionally leaves UPSTASH_REDIS_REST_URL/TOKEN unset,
  // matching local dev / this test environment -- so every limiter in
  // lib/rate-limit.ts is null here. This exercises exactly the fail-open
  // behavior that keeps checkout/lookup/webhook functional without a
  // real Upstash account (see SECURITY.md). Testing actual blocking
  // behavior requires a real Redis-backed limiter and is a manual
  // verification step once UPSTASH_* is configured -- documented in
  // README/SECURITY.md, not something a unit test can exercise here.
  it("fails open (allows the request) when no limiter is configured", async () => {
    const result = await checkRateLimit(null, "203.0.113.5");
    expect(result).toEqual({ allowed: true });
  });
});
