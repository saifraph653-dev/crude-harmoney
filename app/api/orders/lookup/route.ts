import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp, orderLookupRateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { turnstileEnabled } from "@/lib/turnstile-keys";

// Order lookup is the one enumerable endpoint in this app -- an order
// number is a small, guessable sequence (CH-000001, CH-000002, ...) and
// pairing it with an email is exactly how a guest customer legitimately
// looks up their own order. Everything here is built around the same
// rule: whether the input is malformed, the Turnstile check failed, the
// order doesn't exist, or the order exists but the email doesn't match,
// the response must be byte-for-byte identical and take the same amount
// of time. Otherwise this becomes an oracle for enumerating valid order
// numbers or emails (or for probing which of those checks failed).
//
// Rate limiting (hardest of any endpoint in this app, per the brief) is
// the one intentionally distinct response -- a 429 doesn't leak anything
// about order data, and a real human needs to know to slow down rather
// than conclude their order doesn't exist.

const ARTIFICIAL_DELAY_MS = 400;

const lookupSchema = z
  .object({
    orderNumber: z.string().trim().min(1).max(20),
    email: z.string().trim().min(1).max(254).email(),
    turnstileToken: z.string(),
  })
  .strict();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function delayToFloor(startedAt: number) {
  const remaining = ARTIFICIAL_DELAY_MS - (Date.now() - startedAt);
  if (remaining > 0) await sleep(remaining);
}

const NOT_FOUND = { found: false as const };

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const clientIp = getClientIp((name) => request.headers.get(name));

  const rateLimitResult = await checkRateLimit(orderLookupRateLimit, clientIp);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    await delayToFloor(startedAt);
    return NextResponse.json(NOT_FOUND);
  }

  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    await delayToFloor(startedAt);
    return NextResponse.json(NOT_FOUND);
  }

  // Skipped only when the environment has no usable Turnstile configuration
  // (unset, or one of Cloudflare's public test keys, which pass everything
  // anyway and render a "Testing only" widget to customers). The endpoint is
  // rate limited independently of this.
  const captchaConfigured = turnstileEnabled(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const turnstileOk = captchaConfigured
    ? await verifyTurnstileToken(parsed.data.turnstileToken, clientIp)
    : true;
  if (!turnstileOk) {
    await delayToFloor(startedAt);
    return NextResponse.json(NOT_FOUND);
  }

  const orderNumber = parsed.data.orderNumber.toUpperCase();
  const email = parsed.data.email.toLowerCase();

  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, order_number, status, created_at, subtotal_cents, total_cents, currency, shipping_name, shipping_address_line1, shipping_address_line2, shipping_city, shipping_country, shipping_postal_code",
    )
    .eq("order_number", orderNumber)
    .eq("email", email)
    .maybeSingle();

  if (!order) {
    await delayToFloor(startedAt);
    return NextResponse.json(NOT_FOUND);
  }

  const { data: items } = await admin
    .from("order_items")
    .select("product_name_snapshot, variant_size_snapshot, unit_price_cents, quantity")
    .eq("order_id", order.id);

  await delayToFloor(startedAt);

  return NextResponse.json({
    found: true,
    orderNumber: order.order_number,
    status: order.status,
    createdAt: order.created_at,
    items: (items ?? []).map((item) => ({
      productName: item.product_name_snapshot,
      size: item.variant_size_snapshot,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
    })),
    subtotalCents: order.subtotal_cents,
    totalCents: order.total_cents,
    currency: order.currency,
    shipping: {
      name: order.shipping_name,
      addressLine1: order.shipping_address_line1,
      addressLine2: order.shipping_address_line2,
      city: order.shipping_city,
      country: order.shipping_country,
      postalCode: order.shipping_postal_code,
    },
  });
}
