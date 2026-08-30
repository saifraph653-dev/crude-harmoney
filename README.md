# Crude Harmony — storefront

Guest-checkout streetwear drop storefront. Next.js (App Router) on Vercel,
Supabase Postgres with Row Level Security, hosted-page payments only.

This README grows alongside the build (see the project's step-by-step plan).
Right now it covers local setup through schema + RLS. Payment provider
setup (Apple Pay domain verification) and the load test instructions land
in later sections as those pieces are built.

## Prerequisites

- Node.js 20+
- Docker (for local Supabase — Postgres, PostgREST, Kong run in containers)

## Local setup

```bash
npm install
cp .env.example .env.local
```

Start the local Supabase stack (Postgres + PostgREST + Kong; auth/storage/
studio/etc. are excluded since this project doesn't use them):

```bash
npx supabase start -x gotrue,realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
```

This applies every migration in `supabase/migrations/` to a fresh local
database and prints the local API URL and DB URL.

Fill `.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see below>
SUPABASE_SERVICE_ROLE_KEY=<see below>
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

The local anon/service-role key values are fixed, non-secret defaults
baked into every install of the Supabase CLI (documented at
supabase.com/docs/guides/local-development) — deliberately not pasted
here so secret scanners (including this repo's own gitleaks CI) don't
flag them as a live credential. Get them by inspecting the Kong gateway
config the CLI generates for the local stack:

```bash
docker exec supabase_kong_crude-harmoney sh -c \
  "grep -oE \"sb_(publishable|secret)_[A-Za-z0-9_-]+\" /home/kong/kong.yml" | sort -u
```

The `sb_publishable_...` value is `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the
`sb_secret_...` value is `SUPABASE_SERVICE_ROLE_KEY`. These only work
against your own local stack — they are meaningless outside it. To stop
the stack: `npx supabase stop`. To
wipe the local DB and re-apply all migrations from scratch:
`npx supabase db reset`.

### Adding a migration

```bash
npx supabase migration new <name>
```

Write plain SQL in the generated file under `supabase/migrations/`. Never
hand-edit an already-applied migration; add a new one instead.

`supabase/seed.sql` seeds one sample product (applied automatically by
`supabase db reset`/`supabase start`) so the drop pages have something to
render locally. It's a placeholder for local dev, not the real seed
workflow — that lands as its own deliverable later.

## Running the app

```bash
npm run dev
```

Requires the local Supabase stack running (see above) — the drop pages
read `products`/`variants` through the anon key at request/build time.

## Seeding products

There is no CMS and no admin UI by design (see AGENTS.md/the brief) —
`scripts/seed-products.mjs` is the product-entry workflow. It reads a
JSON file (default `seed/products.json`, or pass a path as the first
argument), validates it with the same zod-`.strict()` discipline as
every other input boundary in this project, and inserts each product
and its variants via the service-role key.

```bash
npm run seed:products                 # seed/products.json
node scripts/seed-products.mjs seed/my-real-drop.json
```

`seed/products.json` ships with one example product (`example-drop-tee`,
`status: "draft"`) as a template — copy its shape for a real drop, and
give each variant a real `sku`, `priceCents` (integer minor units, e.g.
fils), and `stockCount`.

Two things worth knowing before you run it against production data:

- **Re-running is safe, but only skips.** A product whose `slug`
  already exists is left completely untouched — the script never
  updates it. This is deliberate: once a product has sold units, there
  is no way for the script to tell "the operator fixed a typo in the
  JSON" apart from "the operator is about to accidentally reset
  `stock_count` and undo real sales" from a second run. Once a product
  exists, edit it via the Supabase dashboard (Table Editor), per the
  project's "admin work happens in the Supabase dashboard" rule — not
  by re-running this script.
- **Products seed as `"draft"` unless you say otherwise.** Set
  `"status": "live"` in the JSON once the drop should actually appear
  on `/drops`, or flip it in the Supabase dashboard when it's time to
  go live.

## Caching model

This project uses [Cache Components](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
(`cacheComponents: true` in `next.config.ts`), Next 16's current caching
model — not the older `export const revalidate = N` convention. Data
functions in `lib/products.ts` are marked `"use cache"` with an explicit
`cacheLife` (currently the `minutes` profile: revalidate every minute,
hard-expire after an hour), so product/drop data is served from Next's
cache layer rather than a fresh Postgres query on every request.

**Every page in the app is dynamically rendered** (`ƒ` in `npm run
build`'s route summary), including `/drops` — this changed in the
security-headers step and is a deliberate, discussed trade-off, not an
oversight. Next's nonce-based CSP (see SECURITY.md) can only inject a
nonce into framework script tags during per-request server-side
rendering, never into a build-time static shell, so nonces and Partial
Prerendering's static shell are mutually exclusive. `/drops` therefore
lost CDN-edge full-page caching (a request now always invokes a
function), but **not** the "no database call in the critical render
path" property: `"use cache"` caching and page-level static/dynamic
rendering are orthogonal in this model, so `getDropProducts()` etc.
still serve from cache, not Postgres, regardless of the page being
dynamic. Verified by curling every route and confirming the `<script>`
tags' nonces match the response header on every single one — see
SECURITY.md's CSP section for the exact commands.

Live stock is separately, deliberately never cached at all.
`app/api/stock/route.ts` is an uncached route handler that reads
`variants.stock_count` fresh on every call; the `<ProductBuyBox>` client
component polls it every 10s after the page has loaded.

The checkout pages (`/checkout` and friends), `/orders/lookup`, `/`, and
`/drops`/`/drops/[slug]` are all marked `export const instant = false`
and forced dynamic via `connection()` and/or reading a runtime API
(`params`/`searchParams`/`headers()`) — opting out of the "must produce
a static shell" prerender check rather than fighting it. `app/not-found.tsx`,
`app/error.tsx`, and `app/global-error.tsx` are custom (not Next's
built-in versions) for the same reason, plus one more: Next's default
error pages render an inline `style="..."` attribute that the CSP can't
allow without a broader exception than the one already made for
`next/image` (see SECURITY.md).

## Checkout and stock reservation

Guest checkout, single item per order (one variant + quantity, no
multi-product cart in v1):

1. `/drops/[slug]` — pick a size in `<ProductBuyBox>` (client component,
   already polling live stock) → navigates to `/checkout?variant=<id>&qty=<n>`.
2. `/checkout` — re-reads price/stock/product status fresh from the DB
   (`lib/checkout-data.ts`, not cached) for display, then collects
   email + shipping info. Submitting posts to the `submitCheckout`
   Server Action (`app/checkout/actions.ts`).
3. The action validates input with zod `.strict()`, then calls the
   `reserve_stock_and_create_order` Postgres function via the
   service-role client -- this is the one place that decrements
   `stock_count`, and it does so atomically (see SECURITY.md's "Never
   oversell" section). On success it creates a payment-provider checkout
   session through the adapter (`lib/payments/`) and redirects there.
4. Nothing actually charges the customer yet at this point in the
   build -- that's the webhook step. `/checkout/success` and
   `/checkout/cancelled` are placeholder landing pages; real fulfilment
   only happens on the payment webhook, never on this redirect.

**Payment provider:** no merchant account is wired up yet, so
`lib/payments/index.ts` returns `MockPaymentAdapter`, which redirects to
an internal `/checkout/mock/[sessionId]` page instead of a real hosted
checkout. No card fields exist anywhere in this codebase. Swapping in
Dibsy or Tap once the merchant account is approved should only require
changing `lib/payments/index.ts` to return a new adapter implementing
`lib/payments/types.ts`'s `PaymentAdapter` interface.

**Reservation TTL and release:** reservations expire after 10 minutes.
Release happens two ways -- inline (every checkout attempt reclaims its
own variant's expired reservations first, so this doesn't depend on cron
timing) and via `/api/cron/release-reservations` on a Vercel Cron
schedule (`vercel.json`). **Vercel's Hobby plan only allows daily cron
jobs**, so `vercel.json` is set to `0 3 * * *` (once daily) by
default -- see SECURITY.md's "Stock reservation TTL and release"
section for why this doesn't break correctness, just how quickly
`/api/stock` catches up after an abandoned checkout. If you're on a
Pro plan or higher, tighten this to something like `*/5 * * * *` for
displayed stock to recover from an abandoned checkout faster.

Set `CRON_SECRET` (a random 16+ character string) in your environment --
Vercel automatically sends it as the cron request's `Authorization`
header once that env var exists on the project.

## Payment webhook

`app/api/webhooks/payment/route.ts` is what actually confirms a sale --
never the `/checkout/success` browser redirect, which can be forged,
lost, or double-fired. In order:

1. Read the raw request body as text, before anything else. Signature
   verification is over the exact bytes the provider signed; parsing
   first (even `request.json()`) breaks that for providers that sign the
   raw body, which is most of them.
2. Verify the signature (`adapter.verifyWebhookSignature`). Wrong or
   missing signature → `401`, request stops here, nothing is recorded.
3. Parse the now-verified body into a normalized event
   (`adapter.parseWebhookEvent`). Unparseable → `400`.
4. Record the event in `webhook_events` with an insert-or-ignore on the
   unique `(provider, event_id)` index *before* doing anything else --
   this is the idempotency guard. If the row already exists and is
   already `processed`, stop here and acknowledge (`200`,
   `{ok: true, duplicate: true}`) without reprocessing. If it exists but
   isn't `processed` yet (a previous delivery got recorded but the
   process crashed or errored before finishing), process it now using
   that existing row -- this is what makes retries actually get handled
   instead of just deduplicated into a black hole.
5. Fulfil via the `fulfil_order_from_webhook` Postgres function
   (`supabase/migrations`), which re-reads and compares the order's
   stored `total_cents`/`currency` against what the webhook claims was
   charged, and refuses to fulfil on a mismatch.

HTTP status from this endpoint is `200` for everything except a bad
signature or an unparseable body -- including business-logic failures
like an amount mismatch or an order that's already expired. Those are
permanent failures; returning non-200 for them would just make the
provider retry-storm the exact same bad data forever. They're recorded
instead with `processing_status = 'failed'` and an `error_message` on
the `webhook_events` row, which is the alerting mechanism for v1 (query
that table -- see SECURITY.md).

### Simulating a payment locally

There's deliberately no in-app button to simulate a successful payment
(see the mock checkout page) -- that would be a live "pay for any order
for free" endpoint if `MockPaymentAdapter` ever ended up active in
production by accident. Instead, sign a payload by hand and post it to
the real webhook route:

```bash
SESSION_ID="mock_<order-id-from-the-redirect-url>"   # from /checkout/mock/<this>
SECRET="$PAYMENT_MOCK_WEBHOOK_SECRET"                 # from .env.local

BODY=$(printf '{"eventId":"local-test-1","eventType":"payment.succeeded","providerSessionId":"%s","amountCents":28000,"currency":"QAR"}' "$SESSION_ID")
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | sed 's/^.* //')

curl -i -X POST http://localhost:3000/api/webhooks/payment \
  -H "x-mock-signature: $SIG" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

Use a fresh `eventId` each time (it's the idempotency key -- reusing one
just re-triggers the duplicate path). Check the order landed on `paid`:

```bash
psql "$SUPABASE_DB_URL" -c "select order_number, status from orders order by created_at desc limit 1;"
```

## Order confirmation email

Sent from `lib/webhook-processing.ts` exactly once per order, right
after a *fresh* `fulfilled` result from `fulfil_order_from_webhook`
(never on an idempotent replay -- see SECURITY.md). Uses
[Resend](https://resend.com); set `RESEND_API_KEY` and
`RESEND_FROM_EMAIL` (e.g. `Crude Harmony <orders@yourdomain.com>`, using
a domain verified in your Resend account) in `.env.local`/Vercel. If
either is unset, sending is skipped with a console warning -- checkout
and fulfilment still work fully without a Resend account, which is the
default in local dev.

The email template (`lib/email/order-confirmation.ts`) is a plain
function returning `{ subject, html, text }` with no external
dependency beyond `resend` itself -- no React Email, no separate
templating engine.

## Order lookup

`/orders/lookup` — guest customers look up an order with order number +
email, matching the "no accounts" design (see SECURITY.md's "Order
lookup" section for why every response is identical regardless of
whether the order exists, was rejected by Turnstile, or was rate
limited). `components/OrderLookupForm.tsx` is a client component that
renders the Turnstile widget, then POSTs to
`app/api/orders/lookup/route.ts` and renders whatever comes back.
Protected by rate limiting and Cloudflare Turnstile (below) plus the
generic-response/artificial-delay design from the previous step.

## Security headers (CSP, HSTS, etc.)

See SECURITY.md's "Content-Security-Policy" and "Other security
headers" sections for the full design and how to verify each one --
summary here is just where things live and what to configure.

`proxy.ts` sets a nonce-based `Content-Security-Policy` on every
request (fresh nonce per request, no `unsafe-inline` in `script-src`).
This is why every page in the app is now dynamically rendered -- see
"Caching model" above. `next.config.ts`'s `headers()` sets everything
else (HSTS, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `X-Frame-Options`) since those don't need a
per-request value.

Nothing to configure for local dev here. In production, once a real
payment adapter replaces `MockPaymentAdapter`, add that provider's
hosted-checkout domain to `proxy.ts`'s `script-src`/`frame-src` (marked
with a `TODO` comment at the top of the file).

## Rate limiting

[Upstash Redis](https://upstash.com) (REST API, no persistent
connection needed -- works from serverless/edge functions). Set
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from an Upstash
database's REST API credentials. If either is unset, rate limiting is
disabled with a console warning rather than breaking checkout/lookup/
webhook -- **this must be configured before a real launch**, it is not
optional in production. See SECURITY.md's "Rate limiting" section for
the exact limits per endpoint and why.

## Cloudflare Turnstile

Used on `/orders/lookup` only. Create a Turnstile widget at
[the Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
for your real domain, then set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public
by design) and `TURNSTILE_SECRET_KEY` (server-only).

For local dev, Cloudflare publishes real, live test key pairs that work
against the actual Turnstile API without needing an account -- already
set in `.env.local`:

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

This pair always passes verification. Cloudflare also publishes an
"always fails" pair (`2x00000000000000000000AB` /
`2x0000000000000000000000000000000AA`) useful for testing the rejection
path -- see `tests/turnstile.test.ts`. Full list:
https://developers.cloudflare.com/turnstile/troubleshooting/testing/.

## Cloudflare in front of the domain (bot management during drops)

Not application code -- an infrastructure/DNS step for when the domain
goes live. Point the domain's DNS through Cloudflare (proxied, orange-
cloud) and enable Cloudflare's bot management / rate limiting rules
during drop windows as an additional layer in front of the app-level
rate limiting above. Not yet done since there's no live domain yet;
tracked here so it isn't forgotten before the first real drop.

## Tests

```bash
npm test
```

Requires the local Supabase stack to be running (tests connect directly to
Postgres and to the local PostgREST API). Currently covers:

- **RLS is enabled on every table** (`tests/rls.test.ts`) — queries
  `pg_tables` and fails if any table in the `public` schema has
  `rowsecurity = false`. This is the control that catches a table added
  later and never wired up.
- **anon can read only `products`/`variants`** — checks the actual GRANTs
  and policies, and separately makes real HTTP requests through the local
  PostgREST API with the anon key to prove `orders`, `order_items`,
  `stock_reservations`, `webhook_events`, and the two checkout RPC
  functions are all unreachable end-to-end, not just "policy exists on
  paper."
- **Never oversell, under real concurrency** (`tests/no-oversell.test.ts`)
  — seeds a throwaway variant with exactly 30 units, fires 200 concurrent
  `reserve_stock_and_create_order` calls at it over real HTTP to the
  local PostgREST API, and asserts exactly 30 succeed, every failure is
  `insufficient_stock`, and final stock is exactly 0. This is the
  project's core correctness property; see SECURITY.md for what it's
  actually testing. (A separate k6 load test against the full HTTP
  checkout path, reporting p95 latency, lands with the load-test step --
  this vitest test is about correctness, that one is about performance.)
- **Payment webhook** (`tests/webhook.test.ts`) — calls the real route
  handler (not a mock of it) with actual `NextRequest` objects against
  the local Postgres: rejects a missing/wrong signature, rejects a
  correctly-signed but unparseable body, fulfils an order end-to-end on
  a valid signed event and confirms replaying the identical event is a
  no-op (idempotency), and confirms an amount mismatch is flagged
  instead of fulfilling.
- **Order lookup** (`tests/order-lookup.test.ts`) — calls the real route
  handler: finds a real order with matching order number + email;
  asserts a nonexistent order number, a mismatched email, and malformed
  input all produce the byte-identical `{"found":false}` response;
  asserts both the found and not-found paths take at least the
  artificial-delay floor; confirms order number/email matching is
  case-insensitive.
- **Order confirmation email** (`tests/order-confirmation-email.test.ts`)
  — the template function (pure, no network) includes the order
  number/items/total in both HTML and plain text, and HTML-escapes a
  shipping name containing `<script>` rather than passing it through raw.
- **Security headers** (`tests/security-headers.test.ts`) — calls
  `proxy()` and `next.config.ts`'s `headers()` directly: nonce-based
  non-unsafe-inline `script-src`, `frame-ancestors 'none'`, `base-uri
  'self'`, a fresh nonce every call, and every static header
  (HSTS/nosniff/Referrer-Policy/Permissions-Policy/X-Frame-Options) with
  the right value. See SECURITY.md for the manual, real-server
  verification this doesn't (and can't, at the unit level) replace.
- **Rate limiting** (`tests/rate-limit.test.ts`) — IP extraction from
  `x-forwarded-for`/`x-real-ip`, and the fail-open behavior with no
  limiter configured (this test environment's actual state).
- **Turnstile** (`tests/turnstile.test.ts`) — calls the real Cloudflare
  `siteverify` endpoint (not mocked) with both of Cloudflare's published
  test secrets, confirming the "always passes"/"always fails" pairs
  behave as documented, plus fail-closed on a missing token or secret.

## Deployment (Vercel)

Not yet documented in full — still waiting on a real payment adapter
(only `MockPaymentAdapter` exists so far) before there's an actual
deployment worth walking through end to end. Checklist for when you do:

1. Set every variable in `.env.example` in Vercel's Project Settings →
   Environment Variables.
2. `NEXT_PUBLIC_SITE_URL` must be the real production origin (not
   `localhost`) -- it's baked into the payment provider's successUrl/
   cancelUrl.
3. `CRON_SECRET` and `PAYMENT_MOCK_WEBHOOK_SECRET` (or whatever secret
   the real provider issues once wired in): random 16+ character
   strings, `openssl rand -hex 32`.
4. **`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` -- do not skip
   this.** Rate limiting silently no-ops without it (see SECURITY.md);
   the app will work but checkout/lookup/webhook will be unprotected
   against volume abuse.
5. `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` from a real
   Turnstile widget registered for the production domain -- the
   published test keys only work because Cloudflare's API always
   returns the same canned result for them, they provide zero real bot
   protection.
6. Point the domain's DNS through Cloudflare (proxied) and enable bot
   management for drop windows -- see "Cloudflare in front of the
   domain" above.

## Payment provider setup (Apple Pay domain verification)

Apple requires any merchant accepting Apple Pay on the web to verify
ownership of every domain it's offered on. Neither Dibsy nor Tap has
been chosen yet (`lib/payments/index.ts` currently only wires up
`MockPaymentAdapter` -- see "Payment adapter boundary" in SECURITY.md),
so the provider-specific dashboard steps below can't be written yet.
What follows is the generic pattern common to hosted-checkout providers
that support Apple Pay, plus what's already true regardless of which
one you pick, so you're not starting from zero once the merchant
account is approved.

**The pattern, in general:**

1. The payment provider gives you a domain-association file (a plain
   text file, name usually
   `apple-developer-merchantid-domain-association`).
2. It must be served, unmodified, over HTTPS at exactly
   `https://<your-domain>/.well-known/apple-developer-merchantid-domain-association`
   -- no redirects, no extra headers changing the body, `Content-Type`
   generally doesn't matter but the byte content must match exactly
   what the provider issued.
3. You register the domain in the payment provider's dashboard, which
   fetches that URL to verify it, then marks the domain as
   Apple-Pay-enabled on their side.
4. Apple Pay stays broken on that domain until this succeeds -- other
   payment methods (card via the hosted page, etc.) are unaffected.

**Already true, regardless of provider:**

- **Valid HTTPS certificate**: satisfied automatically. Vercel
  provisions and renews TLS certificates for every production domain
  and preview deployment; there's nothing to configure here beyond
  pointing DNS at Vercel (or at Cloudflare in front of it, per
  "Cloudflare in front of the domain" above -- if you do that, make
  sure Cloudflare isn't set to redirect or minify/rewrite the
  `.well-known` path, which would corrupt the file).
- **Where the file needs to live**: this is a static file at a fixed
  path with no auth and no per-request logic, so it belongs in
  `public/.well-known/apple-developer-merchantid-domain-association`
  once you have the real file content -- Next.js serves anything under
  `public/` verbatim at the matching URL path. Do not build a route
  handler for this; a route handler risks adding headers or
  transformations the exact-byte-match check doesn't want.
- **One file per domain**: if you verify both a production domain and
  a preview/staging domain, each needs its own registration (though
  typically only the production domain matters for a real drop).

**Provider-specific, to fill in once Dibsy or Tap is chosen:**

- Exact dashboard location to request/download the domain-association
  file and register the domain.
- Whether the provider wants the file re-verified after Apple Pay
  domain-association files rotate (Apple periodically reissues these
  industry-wide; some providers require re-registration when that
  happens, others handle it transparently).
- Whether Apple Pay is even available in the provider's Qatar/GCC
  merchant offering -- confirm this before assuming it'll be an option
  at all, since not every hosted-checkout provider in the region
  supports it.

This section will get the concrete step-by-step once you tell me which
provider you're going with.

## Load testing

`load-test/checkout.js` is a [k6](https://k6.io) script that exercises
the full checkout path over real HTTP -- product page, live stock check,
checkout page, and the checkout submission itself (which invokes
`reserve_stock_and_create_order()` server-side) -- with 200 virtual
users each making one checkout attempt, per the brief. This is a
different test from `tests/no-oversell.test.ts` (step 3): that one
proves correctness (exactly 30 of 200 concurrent attempts succeed) by
calling the database function directly; this one measures real HTTP
performance under the same load, including Next.js request handling,
PostgREST, and network overhead.

k6 is a standalone binary, not an npm package -- install it per
https://k6.io/docs/get-started/installation/ (e.g. `brew install k6`,
or download a release binary directly).

```bash
# 1. Build and start in production mode (load testing next dev would
#    measure dev-mode overhead, not real behavior)
npm run build && npm start

# 2. In another terminal: seed a dedicated test product/variant
#    (idempotent -- re-running resets stock and clears prior test orders)
npm run load-test:seed
# prints a ready-to-run k6 command with the seeded VARIANT_ID

# 3. Run it
k6 run -e BASE_URL=http://localhost:3000 -e VARIANT_ID=<uuid> load-test/checkout.js
```

The script prints p95 latency per step and a breakdown of outcomes
(reserved / sold out / unexpected) to stdout, and writes the full k6
metrics to `load-test/summary.json` (gitignored).

### What I measured, and why the raw numbers from this environment aren't the ones that matter

Ran this for real against the local stack in the sandbox this was built
in (4 CPU cores, `next start` in production mode, real local Postgres).
At 200 concurrent: **0 oversold** (exactly 30 reserved, 170 correctly
told the size was sold out -- matches `tests/no-oversell.test.ts`'s
result, now confirmed through the real HTTP/Server-Action stack too, not
just the database function directly). Per-step p95:

| Step | p95 |
| --- | --- |
| `GET /api/stock` | 94ms |
| `POST /checkout` (the actual reservation) | 154ms |
| `GET /checkout` | 348ms |
| `GET /drops/[slug]` | **7,819ms** |

That last number is real, reproducible, and worth explaining rather
than hiding: `/drops/[slug]` is a Server-Side-Rendered page (forced
dynamic by the CSP nonce requirement -- see "Caching model" above), and
`next start` runs as a single Node.js process with no built-in
clustering. All 200 requests queue on that one process's event loop for
their SSR work. A single request to the same page takes 75ms; at 20
concurrent VUs the same page's p95 is 701ms; at 200 it's 7,819ms --
that's the signature of serialization on one process, not a fundamentally
slow page. This sandbox also runs the k6 load generator on the same
4-core machine as the server under test, which a correct load test setup
avoids (the generator and the target compete for CPU, inflating server-
side latency further).

**Vercel does not run your app as a single long-lived Node process.**
Each request to a dynamic route is handled by Vercel's own scaling
infrastructure, which is built for exactly this kind of concurrent-
request fan-out. This sandbox's 7.8s number is very unlikely to
reproduce on Vercel, but I can't prove that without testing against
Vercel -- which this environment can't do (no live deployment). The
`/api/stock`, `GET /checkout`, and `POST /checkout` numbers above are
lighter-weight (JSON responses, no full product-page React render) and
plausibly hold up fine regardless of hosting model.

**Before your first real drop:** re-run this exact load test
(`k6 run -e BASE_URL=https://your-preview-url.vercel.app -e VARIANT_ID=...`)
against a real Vercel preview or production deployment, from a machine
that isn't also running the app, and look specifically at
`drop_page_duration`'s p95. If it's still high there, that's a real
finding worth investigating (e.g. whether `/drops/[slug]`'s forced-dynamic
requirement from the CSP nonce trade-off needs a lighter render, or a
Vercel plan/region adjustment) -- not something this sandbox test alone
can rule in or out.
