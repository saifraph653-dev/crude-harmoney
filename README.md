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
  `stock_reservations`, `webhook_events` are unreachable end-to-end, not
  just "policy exists on paper."

## Deployment (Vercel)

Not yet documented — lands with the checkout/payment steps.

## Payment provider setup (Apple Pay domain verification)

Not yet documented — lands once the payment adapter is built.

## Load testing

Not yet documented — lands with the load test step.
