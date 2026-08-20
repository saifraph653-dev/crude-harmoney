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

## Caching model

This project uses [Cache Components](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
(`cacheComponents: true` in `next.config.ts`), Next 16's current caching
model — not the older `export const revalidate = N` convention. Data
functions in `lib/products.ts` are marked `"use cache"` with an explicit
`cacheLife` (currently the `minutes` profile: revalidate every minute,
hard-expire after an hour) so the drop pages are served as a static,
cached shell with no database call in the request path. `generateStaticParams`
prerenders every live product at build time; any other slug (e.g. one that
goes live between deploys) gets an instant App Shell on first visit and is
upgraded to a fully static page in the background for the next visitor.

Live stock is deliberately excluded from that cache. `app/api/stock/route.ts`
is an uncached route handler that reads `variants.stock_count` fresh on
every call; the `<ProductBuyBox>` client component polls it every 10s after
the cached page has loaded. Verify the split with `npm run build` — the
route summary should show `/drops` and `/drops/[known-slug]` as static (`○`)
and `/api/stock` as dynamic (`ƒ`).

The checkout pages (`/checkout` and friends) are marked `export const
instant = false` — they read `searchParams` and do an always-fresh DB
read by design, so they're opted out of the "must produce a static
shell" prerender check rather than restructured to fit it. They don't
benefit from caching the way `/drops` does: each is visited once per
purchase attempt, not once per browsing session.

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
timing) and via `/api/cron/release-reservations` on a 5-minute Vercel
Cron schedule (`vercel.json`) for keeping displayed stock accurate.
**If deploying on Vercel's Hobby plan, note that Hobby cron jobs run at
most once per day** -- see SECURITY.md's "Stock reservation TTL and
release" section for why this doesn't break correctness, just how
quickly `/api/stock` catches up after an abandoned checkout.

Set `CRON_SECRET` (a random 16+ character string) in your environment --
Vercel automatically sends it as the cron request's `Authorization`
header once that env var exists on the project.

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

## Deployment (Vercel)

Not yet documented — lands with the payment webhook step (once a real
adapter exists, there's an actual deployment worth walking through end
to end, including the `CRON_SECRET` and `NEXT_PUBLIC_SITE_URL` env vars
introduced in this step).

## Payment provider setup (Apple Pay domain verification)

Not yet documented — lands once the payment adapter is built.

## Load testing

Not yet documented — lands with the load test step.
