import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting by IP on checkout-session creation, order lookup, and the
 * webhook endpoint, per the brief. Fails OPEN (allows the request, logs a
 * warning) when Upstash isn't configured -- same pattern as Resend/the
 * payment adapter: local dev and any environment without the real
 * service stays fully functional. This is a real gap if it ships to
 * production unconfigured -- see SECURITY.md and the README deployment
 * checklist, both call this out explicitly.
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedisClient();

function makeLimiter(requests: number, window: `${number} ${"s" | "m" | "h"}`): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
    prefix: "crude-harmoney",
  });
}

// Order lookup is the one enumerable endpoint (see app/api/orders/lookup/
// route.ts) -- rate limited hardest, per the brief's explicit instruction.
export const orderLookupRateLimit = makeLimiter(5, "1 m");
export const checkoutRateLimit = makeLimiter(10, "1 m");
// Generous: payment providers retry webhooks on their own schedule, and
// a legitimate burst of deliveries (e.g. catching up after downtime)
// must not get throttled into failure.
export const webhookRateLimit = makeLimiter(60, "1 m");

export function getClientIp(headerLookup: (name: string) => string | null): string {
  const forwardedFor = headerLookup("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headerLookup("x-real-ip") ?? "unknown";
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<RateLimitResult> {
  if (!limiter) {
    console.warn(
      "UPSTASH_REDIS_REST_URL/TOKEN not set -- rate limiting is disabled, allowing request",
    );
    return { allowed: true };
  }

  const result = await limiter.limit(identifier);
  if (result.success) return { allowed: true };

  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
  return { allowed: false, retryAfterSeconds };
}
