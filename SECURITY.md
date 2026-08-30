# Security controls

Every control below maps to a requirement from the project brief. Each entry
says what it is, where it lives, and exactly how to re-verify it yourself
later.

## Checklist

Grouped the way the original brief grouped them, for scanning against your
own mental checklist. ✅ = built and verified (see that section for how).
⚠️ = built, but with a real caveat that needs your attention before launch.
⏳ = intentionally not applicable yet (no real payment provider/domain).

**Secrets and git hygiene**
- ✅ [Secrets and git hygiene](#secrets-and-git-hygiene) — `.env.local` gitignored from commit one, gitleaks pre-commit + CI, `.env.example`
- ✅ [Build-time assertion: server-only code never reaches a client bundle](#build-time-assertion-server-only-code-never-reaches-a-client-bundle)

**Database and Row Level Security**
- ✅ [Row Level Security (database)](#row-level-security-database) — RLS enabled on every table, default-deny, a test that fails the build if any table has RLS disabled
- ✅ [Least privilege on public reads](#least-privilege-on-public-reads) — anon key everywhere it's used, service-role key nowhere near a client bundle

**Don't trust the client**
- ✅ [Server-computed totals, server-validated input](#server-computed-totals-server-validated-input)
- ✅ [Input validation on public endpoints](#input-validation-on-public-endpoints) — zod `.strict()` everywhere user input enters
- ✅ [Explicit column allow-lists and DTOs, never raw rows](#explicit-column-allow-lists-and-dtos-never-raw-rows)

**Never oversell**
- ✅ [Never oversell (atomic stock reservation)](#never-oversell-atomic-stock-reservation) — proven at the database layer (200 concurrent, exactly 30 succeed) and again through the real HTTP stack (k6)
- ✅ [Stock reservation TTL and release](#stock-reservation-ttl-and-release)

**Payments**
- ✅ [Webhook signature verification (raw body, before parsing)](#webhook-signature-verification-raw-body-before-parsing)
- ✅ [Webhook idempotency (insert-or-ignore before processing)](#webhook-idempotency-insert-or-ignore-before-processing)
- ✅ [Amount verification before fulfilling](#amount-verification-before-fulfilling)
- ✅ [Confirm the sale on the webhook, never the browser redirect](#confirm-the-sale-on-the-webhook-never-the-browser-redirect)
- ✅ [Payment adapter boundary (PCI SAQ-A)](#payment-adapter-boundary-pci-saq-a)
- ⏳ **Apple Pay domain verification** — no merchant account yet; see README's "Payment provider setup" section for the generic procedure and what's provider-specific.

**Transport and headers**
- ✅ [Content-Security-Policy: nonces, no unsafe-inline](#content-security-policy-nonces-no-unsafe-inline-with-one-narrow-documented-exception) (one narrow, documented exception for `next/image`'s inline style attribute)
- ✅ [Other security headers](#other-security-headers) — HSTS, nosniff, Referrer-Policy, Permissions-Policy, X-Frame-Options
- ✅ HTTPS enforcement — see "Other security headers," handled by Vercel's platform TLS termination + the HSTS header

**Abuse and bots**
- ⚠️ [Rate limiting](#rate-limiting) — built and tested, but **fails open if `UPSTASH_REDIS_REST_URL`/`TOKEN` aren't set in production**. Confirm they're set before launch.
- ✅ [Order lookup: identical response, no enumeration oracle](#order-lookup-identical-response-no-enumeration-oracle)
- ✅ [Cloudflare Turnstile on order lookup](#cloudflare-turnstile-on-order-lookup)
- ⏳ **Cloudflare in front of the domain** — infrastructure/DNS, not application code; see README's "Cloudflare in front of the domain" section. Not done since there's no live domain yet.

**Injection and output**
- ✅ [No string-concatenated SQL](#no-string-concatenated-sql)
- ✅ [Output escaping: no dangerouslySetInnerHTML, sanitized free text](#output-escaping-no-dangeroussetinnerhtml-sanitized-free-text)

**Dependencies**
- ⚠️ [Dependencies](#dependencies) — `npm audit` + lint + build in CI, Dependabot enabled. The database-backed test suite (RLS, no-oversell, webhook, order-lookup) is not yet wired into CI — see that section.

## Secrets and git hygiene

**Control:** `.env.local` is gitignored (it always has been — `.gitignore`
was in place before the first commit). `.env.example` is committed with
empty values for every variable the app needs, so a new environment can be
set up without guessing names. Every staged commit is scanned for secrets
by gitleaks before it's created; every push is scanned again in CI as the
real enforcement boundary (a contributor without gitleaks installed
locally still can't land a secret).

**Where:** `.gitignore`, `.env.example`, `.githooks/pre-commit` (installed
automatically by `npm install` via the `prepare` script pointing
`core.hooksPath` at `.githooks`), `.github/workflows/gitleaks.yml`.

**How to verify:**

1. `git check-ignore -v .env.local` → must print a match against
   `.gitignore`.
2. `git log --all --full-history -- .env.local` → must be empty (nothing
   ever committed).
3. `git config --get core.hooksPath` → must print `.githooks` after
   `npm install`.
4. Stage a fake secret and attempt a commit with gitleaks installed
   locally (`brew install gitleaks` or see
   https://github.com/gitleaks/gitleaks#installing) — the commit must be
   rejected. Example: `echo 'AWS_SECRET_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE' >> /tmp/x && git add -N /tmp/x` won't trigger it (outside the repo); instead add a line like
   `sk_live_51H...` to a tracked file, `git add` it, and try to commit.
5. Check the "gitleaks" workflow run on the repo's Actions tab after any
   push — it must be green, and pushing a commit containing a plausible
   secret pattern must fail it.

**If a key is ever committed:** rotate it immediately in the provider's
dashboard (Supabase, the payment provider, Resend, Upstash, etc.).
Scrubbing git history (`git filter-repo`, BFG, force-push) does not
un-compromise the key — assume anyone who ever fetched the repo has it,
rotate first, clean history second (or not at all).

## Row Level Security (database)

**Control:** RLS is enabled on every table in the `public` schema, with
default-deny — no policy means no access, for every role except
`service_role`. `products` and `variants` get an explicit `SELECT` policy
for `anon`/`authenticated`, scoped to non-draft rows. `orders`,
`order_items`, `stock_reservations`, `webhook_events` get zero policies:
nothing but `service_role` (server-only, bypasses RLS) can touch them.

As defense in depth, `anon`/`authenticated` are also not `GRANT`ed any
privilege at all on the restricted tables — even if a policy were added by
mistake later, PostgREST still can't see the table without an explicit
`GRANT`.

**Where:** `supabase/migrations/20260820222001_initial_schema.sql` (schema),
`supabase/migrations/20260820222002_rls_policies.sql` (RLS + grants).

**How to verify:**

1. Automated: `npm test` runs `tests/rls.test.ts`, which:
   - queries `pg_tables` and fails if any table has `rowsecurity = false`
   - queries `information_schema.role_table_grants` and fails if `anon` has
     any grant beyond `SELECT` on `products`/`variants`
   - queries `pg_policies` and fails if `orders`, `order_items`,
     `stock_reservations`, or `webhook_events` has any policy at all
   - makes real HTTP requests to the local PostgREST API with the anon key
     and asserts `products`/`variants` return 200 and the other four do not
2. Manual, against any environment (swap in the target's URL/anon key):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" \
     "$SUPABASE_URL/rest/v1/orders?select=id" \
     -H "apikey: $ANON_KEY"
   ```
   Must return 401 with a `permission denied for table orders` body, never
   200 and never an empty array (an empty array can mean "policy allowed
   this, zero rows matched" — that is not the same thing as "denied").
3. Manual, in the Supabase SQL editor (works against any Postgres, local or
   cloud):
   ```sql
   select tablename, rowsecurity from pg_tables where schemaname = 'public';
   -- every row must show rowsecurity = true

   select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public';
   -- only products/variants should appear, both with a SELECT policy for anon
   ```

**Why `service_role` still works:** the Supabase platform (cloud and local
CLI) creates the `service_role` Postgres role with `BYPASSRLS`. It is
unaffected by any policy in this file. That's what lets server-side code
using `SUPABASE_SERVICE_ROLE_KEY` write orders. That key must never reach
the browser — see the "Secrets" section (added when the checkout step
lands, which is the first step that actually uses the service-role key in
application code).

## Least privilege on public reads

**Control:** every public-facing read (`lib/products.ts`, the live-stock
route handler) uses the anon/publishable key, never the service-role key.
The anon key can only ever do what the RLS policies above allow — even a
bug in application code (a typo'd `.eq()`, a missing filter) can't leak
`orders`, `order_items`, `stock_reservations`, or `webhook_events`, because
the database itself refuses the request regardless of what the app code
asked for. The service-role key isn't introduced into the codebase at all
until the checkout step, which is the first place server code needs to
write orders.

**Where:** `lib/supabase/public.ts` (the only Supabase client factory that
exists so far).

**How to verify:** `grep -rn SUPABASE_SERVICE_ROLE_KEY app lib` should
currently return nothing — the identifier shouldn't appear anywhere in
application code yet.

## Input validation on public endpoints

**Control:** every route handler and Server Action validates its input
with zod `.strict()` before touching the database, per the project's
blanket rule ("validate every server action and route handler input
with zod") -- `.strict()` specifically, not just `.parse()`, so an
unexpected extra field is rejected rather than silently ignored.
`app/api/stock/route.ts` rejects anything that isn't 1-50 comma-separated
UUIDs with a 400, before any query runs.

**Where:** `app/api/stock/route.ts`, `lib/checkout.ts` (schema used by
`app/checkout/actions.ts`), `app/api/orders/lookup/route.ts`,
`scripts/seed-products.mjs` (the one script that touches the database
directly with operator-supplied data, not a request handler, but the
same rule applies).

**How to verify:**

```bash
curl -i "$APP_URL/api/stock?variantIds=not-a-uuid"   # 400
curl -i "$APP_URL/api/stock"                          # 400, missing param
curl -i "$APP_URL/api/stock?variantIds=$REAL_UUID"    # 200
```

Or: `grep -rn '\.strict()' lib app` -- every zod object schema that
parses external input should have one.

## Explicit column allow-lists and DTOs, never raw rows

**Control:** every Supabase query in this codebase names its columns
explicitly (`.select("id, order_number, status, ...")`); there is no
`.select("*")` anywhere. API responses and email/DTO builders construct
a new plain object with exactly the fields the caller needs
(`lib/dto/order-lookup.ts`, `lib/dto/products.ts`, the JSON bodies built
in `app/api/orders/lookup/route.ts` and `app/api/stock/route.ts`) rather
than forwarding a database row. This matters because a table gaining a
new column later (say, an internal ops note field) can't silently leak
into a response just because a handler happened to select everything --
each response's shape is a deliberate choice made at the point it's
built, not a byproduct of whatever the table currently looks like.

**Where:** everywhere a Supabase query exists -- `grep -rn "select(" app
lib` and confirm none is `"*"`.

**How to verify:** `grep -rn '\.select(\s*["'"'"'\`]\*["'"'"'\`]' app lib`
should return nothing.

## No string-concatenated SQL

**Control:** every database access from application code goes through
either the Supabase JS client's query builder (which parameterizes
everything itself) or a named Postgres function called via `.rpc()`
with named arguments (never a raw SQL string built by concatenating
user input) -- `reserve_stock_and_create_order`,
`fulfil_order_from_webhook`, `release_expired_reservations`. The
project's `pg` dependency (used only in `tests/rls.test.ts` for direct
Postgres introspection queries against `pg_catalog`/`information_schema`)
uses parameterized placeholders (`$1`) for the one query that takes a
variable, and every other query in that file is a static string with no
user input at all.

**Where:** the entire `app/`/`lib/` tree (Supabase client + `.rpc()`
only), `supabase/migrations/*.sql` (all static SQL, not generated from
user input), `tests/rls.test.ts` (the one place raw SQL is written by
hand, for schema introspection, not user data).

**How to verify:** `grep -rn "query(\`" app lib` (backtick-templated SQL
built at runtime) should return nothing.

## No database call in the critical render path

**Control:** the drop pages (`/drops`, `/drops/[slug]`) are built with
[Cache Components](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
(`cacheComponents: true`) and `"use cache"` on the data functions in
`lib/products.ts`, so they're served as a prerendered static shell — no
request-time database round trip. This matters for the brief's core
threat model (200 concurrent buyers in a 10-minute window): even if
Postgres is slow or briefly unavailable, the page that tells people the
drop exists still loads instantly from cache. Only `app/api/stock/route.ts`
hits the database on every call, by design — see the README's "Caching
model" section.

**Where:** `next.config.ts` (`cacheComponents`), `lib/products.ts`
(`"use cache"` + `cacheLife`), `app/drops/page.tsx`, `app/drops/[slug]/page.tsx`.

**How to verify:** `npm run build` and check the route summary — `/drops`
and any known product slug must show `○` (static); only `/api/stock`
should show `ƒ` (dynamic). Re-run after any change to `lib/products.ts`
to make sure a new code path hasn't accidentally pulled a live DB call
into the page itself.

## Never oversell (atomic stock reservation)

**Control:** the only place `variants.stock_count` ever changes is a
single conditional `UPDATE ... WHERE stock_count >= quantity RETURNING
stock_count` inside the `reserve_stock_and_create_order()` Postgres
function — never a read-then-write, never arithmetic done in application
code. If the `WHERE` clause matches zero rows, the function raises and
the whole transaction (including the order and order_items rows it
would have inserted) rolls back, so a failed reservation never leaves a
partial order behind. The mirror-image operation,
`release_expired_reservations()`, restocks the same way (aggregated
`UPDATE ... SET stock_count = stock_count + quantity`), so two
overlapping releases for the same variant can't double-count.

Both functions are plain SQL functions, not RLS-governed tables, so they
need their own lockdown: `revoke all ... from public` + `grant execute
... to service_role` in the migration, since Postgres grants EXECUTE on
new functions to `PUBLIC` (which `anon`/`authenticated` inherit) by
default. Without that explicit revoke, anyone with the anon key could
call `reserve_stock_and_create_order` directly over PostgREST and create
orders, bypassing every RLS wall on the `orders` table entirely.

**Where:** `supabase/migrations/20260820230015_checkout_reservations.sql`,
called from `app/checkout/actions.ts` via the service-role client.

**How to verify:**

1. `npm test` runs `tests/no-oversell.test.ts`: seeds a throwaway variant
   with exactly 30 units, fires 200 concurrent
   `reserve_stock_and_create_order` calls at it, and asserts exactly 30
   succeed, every failure is `insufficient_stock` (not some other
   error), final `stock_count` is exactly 0, and exactly 30 order rows
   exist. It also asserts `anon` cannot call either function at all
   (`tests/rls.test.ts`).
2. Manually: run the same query the test does, or watch `stock_count`
   never go negative under `npm run dev` while spamming the checkout
   form for a low-stock variant.

## Stock reservation TTL and release

**Control:** `reserve_stock_and_create_order()` sets a 10-minute
`expires_at` on the `stock_reservations` row it creates. Two independent
mechanisms release an expired reservation, and correctness depends on
neither running promptly:

- **Lazy, inline reclaim.** Every call to `reserve_stock_and_create_order`
  first releases *that variant's* own expired reservations before
  checking availability. This means correctness never depends on the
  cron job's schedule — even if it never ran, the next real purchase
  attempt for a given size reclaims any abandoned holds on it first.
- **`app/api/cron/release-reservations`**, invoked by Vercel Cron (see
  `vercel.json`, every 5 minutes), sweeps *all* expired reservations.
  This exists to keep the publicly *displayed* stock count
  (`/api/stock`) accurate for people who are browsing but not currently
  checking out that size, and to flip abandoned `pending` orders to
  `expired`.

**Vercel Hobby-plan caveat:** Hobby-tier cron jobs can only run once per
day (Vercel's limit, not this app's). On Hobby, `/api/stock` could show
a stale "sold out" for up to ~24h after someone abandons a checkout for
that size, even though the lazy reclaim above means a real purchase
attempt would succeed immediately. If that gap matters, either upgrade
to Pro (per-minute crons) or call `/api/cron/release-reservations`
yourself on a shorter interval from an external scheduler.

The cron endpoint is protected the way Vercel's own docs recommend:
compare the `Authorization` header against `CRON_SECRET`, which Vercel
sends automatically when that env var is set on the project.

**Where:** `reserve_stock_and_create_order()` and
`release_expired_reservations()` in
`supabase/migrations/20260820230015_checkout_reservations.sql`,
`app/api/cron/release-reservations/route.ts`, `vercel.json`.

**How to verify:**

```bash
curl -i https://$YOUR_DOMAIN/api/cron/release-reservations              # 401
curl -i -H "Authorization: Bearer wrong" https://$YOUR_DOMAIN/api/cron/release-reservations  # 401
curl -i -H "Authorization: Bearer $CRON_SECRET" https://$YOUR_DOMAIN/api/cron/release-reservations  # 200
```

Then manually expire a reservation (`update stock_reservations set
expires_at = now() - interval '1 minute' where id = '...'`) and confirm
re-running the cron call restocks the variant and flips the order to
`expired`.

## Server-computed totals, server-validated input

**Control:** `app/checkout/actions.ts` never reads a price or total from
the client — `reserve_stock_and_create_order()` re-reads
`variants.price_cents` server-side and computes `total_cents` in SQL.
The only client-supplied values that reach the database are a variant
ID, a quantity, and free-text shipping/contact fields, all validated
with zod `.strict()` (`lib/checkout.ts`) before the RPC call — unknown
form fields are rejected rather than silently ignored.

**Where:** `lib/checkout.ts` (schema), `app/checkout/actions.ts`
(validates, then calls the RPC).

**How to verify:** `grep -n "total_cents\|price_cents" app/checkout/actions.ts`
should show these values only ever come back *from* the RPC response,
never computed in TypeScript or read from `formData`.

## Payment adapter boundary (PCI SAQ-A)

**Control:** `lib/payments/types.ts` defines the only interface
application code uses to talk to a payment provider — it carries an
amount, currency, and identifiers, never a card number, CVV, or expiry.
Card entry will happen entirely on the provider's hosted page/iframe
once a real adapter (Dibsy/Tap) replaces `MockPaymentAdapter`; nothing
in this codebase is positioned to ever see or store card data.

**Where:** `lib/payments/`.

**How to verify:** `grep -rniE "card|cvv|pan|expiry" lib/payments app/checkout`
should turn up only this kind of comment, never a field name or variable
that holds card data.

## Confirm the sale on the webhook, never the browser redirect

**Control:** `/checkout/success` (the page the customer's browser lands
on after paying) does nothing but display a "we're confirming your
payment" message — it never touches `orders.status`. The only code path
that can move an order to `paid` is `app/api/webhooks/payment/route.ts`
calling `fulfil_order_from_webhook()`. This matters because a browser
redirect can be forged (a customer could just visit the success URL
directly), lost (browser closed mid-redirect), or double-fired — none of
those should be able to grant a free order.

**Where:** `app/checkout/success/page.tsx` (display-only),
`app/api/webhooks/payment/route.ts` (the only writer).

**How to verify:** `grep -n "orders" app/checkout/success/page.tsx`
should return nothing. Visiting `/checkout/success?order=<real order
number>` directly, without ever paying, must not change that order's
status — confirm with `select status from orders where order_number =
'...'` before and after.

## Webhook signature verification (raw body, before parsing)

**Control:** `app/api/webhooks/payment/route.ts` reads the request body
as raw text (`request.text()`) and verifies
`adapter.verifyWebhookSignature(rawBody, signatureHeader)` before
anything else runs — in particular, before any `JSON.parse`. This
ordering is required, not stylistic: most providers (including the mock
adapter's HMAC scheme) sign the exact byte sequence of the body, so
parsing and re-serializing it first would produce different bytes and
break every signature. `MockPaymentAdapter.verifyWebhookSignature` also
uses `crypto.timingSafeEqual` rather than `===`, so a wrong signature
guess can't be narrowed down via response-time differences.

**Where:** `app/api/webhooks/payment/route.ts`,
`lib/payments/mock-adapter.ts`.

**How to verify:** `tests/webhook.test.ts` posts requests with no
signature, a wrong signature, and a valid one, and asserts 401/401/200
respectively. Manually: see README's "Simulating a payment locally" —
change one character of `$SIG` before sending and confirm you get a 401
instead of a fulfilled order.

## Webhook idempotency (insert-or-ignore before processing)

**Control:** every webhook event is recorded in `webhook_events` via an
insert-or-ignore on the unique `(provider, event_id)` index *before* any
fulfilment logic runs (`ON CONFLICT (provider, event_id) DO NOTHING`,
via PostgREST's `upsert(..., { onConflict, ignoreDuplicates: true })`).
A genuinely new event proceeds to fulfilment; a duplicate delivery of an
already-`processed` event is acknowledged and skipped without
reprocessing; a duplicate delivery of an event that was recorded but
never finished processing (e.g. the server crashed mid-request) is
retried using the existing ledger row, so retries can't be silently
swallowed into a stuck `pending` state. Payment providers are documented
to retry webhook delivery — this is the control built specifically for
that.

**Where:** `app/api/webhooks/payment/route.ts`, the unique index in
`supabase/migrations/20260820222001_initial_schema.sql`.

**How to verify:** `tests/webhook.test.ts`'s "is idempotent on replay"
case posts the identical signed event twice and asserts the order is
fulfilled exactly once (`status = 'paid'` after both, no error, no
double-processing). Manually: run the same signed curl request from
README's "Simulating a payment locally" section twice in a row and
confirm the second response is `{"ok":true,"duplicate":true}`.

## Amount verification before fulfilling

**Control:** `fulfil_order_from_webhook()` (Postgres function) re-reads
the order's stored `total_cents`/`currency` and compares them against
what the webhook payload claims was charged, under a row lock (`FOR
UPDATE`) so a concurrent delivery can't read a stale value. A mismatch
returns `'amount_mismatch'` and the order is left `pending` — never
fulfilled on a guess. The webhook route records this outcome as
`processing_status = 'failed'`, `error_message = 'amount_mismatch'` on
the `webhook_events` row.

**"Alert" for v1:** there's no paging/Slack/email alerting service in
this stack (deliberately — see the brief's dependency list). The
`webhook_events` table *is* the alert surface: query
`select * from webhook_events where processing_status = 'failed'` in
the Supabase dashboard periodically, or wire up a Supabase dashboard
alert/scheduled report later if volume ever justifies it. The same
query surfaces `order_not_payable` (reservation expired before the
webhook arrived) and `paid_but_reservation_lost` (the rare TTL-boundary
race described in the migration's comments) — both need a human to look
at the specific order, not an automated fix.

**Where:** `fulfil_order_from_webhook()` in
`supabase/migrations/20260820231850_webhook_fulfilment.sql`.

**How to verify:** `tests/webhook.test.ts`'s "flags an amount mismatch"
case. Manually: send a signed webhook with `amountCents` one off from
the real order total and confirm the order stays `pending` and the
`webhook_events` row shows `processing_status = 'failed'`.

## Order lookup: identical response, no enumeration oracle

**Control:** `app/api/orders/lookup/route.ts` is the only way to read an
`orders` row from the outside (the table has zero RLS policies -- see
"Row Level Security" above -- so nothing gets in except through this
server route, using the service-role key). It returns the exact same
`{"found":false}` body, with the same HTTP 200 status, whether the input
is malformed, the order number doesn't exist, or the order exists but
the email doesn't match. A response that distinguished any of those
cases -- even just by timing -- would let an attacker use the endpoint
as an oracle: enumerate order numbers by trying many emails against a
known guess (order numbers are a small sequential space, `CH-000001`,
`CH-000002`, ...), or probe whether a given email placed any order at
all.

**Where:** `app/api/orders/lookup/route.ts`.

**How to verify:**

1. `tests/order-lookup.test.ts` asserts a nonexistent order number, a
   mismatched email, and malformed/extra-field input all produce
   byte-identical `{"found":false}` responses, and that both the found
   and not-found paths take at least the artificial-delay floor
   (currently 400ms) -- so timing can't distinguish them either.
2. Manually:
   ```bash
   curl -s -w '\n%{time_total}\n' -X POST "$APP_URL/api/orders/lookup" \
     -H 'Content-Type: application/json' \
     -d '{"orderNumber":"CH-999999","email":"nobody@example.com"}'
   # compare against a real order number + wrong email, and a real
   # order number + right email -- response shape and rough timing
   # should look the same for the first two, and only the third reveals
   # order data.
   ```

**Not yet implemented (lands in the security-headers step, per the
brief):** rate limiting by IP and Cloudflare Turnstile. The artificial
delay here is a narrower, complementary control -- it defends the
single-request timing side channel regardless of volume; rate limiting
defends against volume regardless of timing. Both are needed.

## Order confirmation email

**Control:** `lib/webhook-processing.ts` sends the confirmation email
exactly once per order -- only on the RPC result `'fulfilled'` (a fresh
pending→paid transition), never on `'already_fulfilled'` (an idempotent
webhook replay). This piggybacks on the same idempotency guarantee that
prevents double-fulfilment, so there's no separate "have we emailed this
order" flag to keep in sync.

A failed email send is caught and recorded as a `warning` on the
`webhook_events` row (`error_message = 'email_send_failed: ...'`) but
does **not** flip `processing_status` to `'failed'` and does **not**
make the webhook route return a non-200 -- the payment already
succeeded and the order is already `paid`; an email hiccup must never
look like a fulfilment failure or make the payment provider retry an
already-successful webhook. If Resend isn't configured at all
(`RESEND_API_KEY`/`RESEND_FROM_EMAIL` unset), sending is skipped with a
console warning rather than throwing -- keeps local dev and any
environment without a Resend account fully functional; the customer can
always use order lookup instead.

Every value interpolated into the HTML email (`lib/email/order-confirmation.ts`)
is HTML-escaped, including the shipping name/address -- those are
customer-supplied free text.

**Where:** `lib/email/order-confirmation.ts` (template, pure function),
`lib/email/send-order-confirmation.ts` (Resend call + graceful skip),
`lib/webhook-processing.ts` (trigger point).

**How to verify:**

1. `tests/order-confirmation-email.test.ts` checks the built email
   contains the order number/items/total in both HTML and plain text,
   and that a shipping name containing `<script>` is escaped in the
   HTML output rather than passed through raw.
2. `tests/webhook.test.ts`'s fulfilment test implicitly covers the
   graceful-skip path (no `RESEND_API_KEY` in the test environment) and
   confirms a skipped/failed email doesn't affect the `{"ok":true}`
   response or the order's `paid` status.
3. Manually, once Resend is configured: run the "Simulating a payment
   locally" recipe from README and check the inbox for `RESEND_FROM_EMAIL`'s
   configured recipient.

## Content-Security-Policy: nonces, no unsafe-inline (with one narrow, documented exception)

**Control:** `proxy.ts` generates a fresh, unique nonce on every request
and sets a `Content-Security-Policy` header with `script-src 'self'
'nonce-<value>' 'strict-dynamic' https://challenges.cloudflare.com`
(the Cloudflare domain is for the Turnstile widget script; nothing else
is allowlisted). No `'unsafe-inline'` in `script-src`, ever.
`frame-ancestors 'none'` and `base-uri 'self'` are also set.

**A conflict I found and flagged rather than silently resolving:**
Next.js's own docs state nonce-based CSP requires every page to be
dynamically rendered, and is flatly incompatible with Partial
Prerendering -- exactly the mechanism the `/drops` static-shell caching
from the product-pages step relied on. I stopped and asked before
proceeding; the resolution chosen was "nonces everywhere, accept dynamic
rendering." Concretely:

- Every page (`/`, `/drops`, `/drops/[slug]`, `/orders/lookup`,
  `/checkout` and its sub-pages, the custom `not-found`/`error`/
  `global-error` pages) is forced dynamic, via `connection()` and/or
  reading a runtime API (`params`, `searchParams`, `headers()`) plus
  `export const instant = false` to opt out of the "must produce a
  static shell" build validation.
- This does **not** reintroduce a database call in the critical render
  path. `lib/products.ts`'s `"use cache"`-wrapped data functions still
  serve from Next's cache layer regardless of whether the calling page
  is statically or dynamically rendered -- "use cache" caching and
  page-level static/dynamic rendering are orthogonal in Next's Cache
  Components model. What's actually lost is CDN-edge full-page caching
  (Vercel serving the static HTML with zero function invocation) --
  every request now invokes a function, but that function still doesn't
  touch Postgres for product/drop data.
- **Verified empirically, not just reasoned about:** built and ran the
  app with a live local Supabase stack, then for every route (including
  the not-found page, the mock payment page, and every checkout step)
  curled it and diffed every `<script>` tag's `nonce="..."` attribute
  against that same response's `Content-Security-Policy` header nonce.
  Zero mismatches across every route, on every check. `npm run build`'s
  route summary before/after this change is also directly comparable
  (`○`/`◐` → `ƒ` on every page except two dynamic-segment routes that
  stayed `◐` Partial Prerender for framework-internal reasons but still
  produce 100%-matching nonces when checked the same way).

**The one documented exception:** `style-src` is `'self' 'unsafe-inline'`
with **no** nonce. `next/image` unconditionally sets an inline
`style="color:transparent"` attribute on every `<img>` it renders
(`get-img-props.js` in the Next.js source -- there is no supported prop
to disable it), and CSP nonces do not cover inline style *attributes* at
all, only `<style nonce="...">` blocks. This codebase has zero inline
`<style>` blocks (verified by grepping every route's rendered HTML), so
the actual exposure of this exception is nil beyond that one
framework-fixed, non-attacker-controllable value. `script-src` has no
such exception and stays strictly nonce-based -- CSS injection and
script injection are not remotely comparable severities, which is the
entire reason strict CSPs commonly draw this exact line.

**Where:** `proxy.ts` (CSP + nonce generation), `next.config.ts`
(everything else, see below), `app/not-found.tsx`/`app/error.tsx`/
`app/global-error.tsx` (custom, because Next's built-in versions render
inline `style="..."` attributes that would need the same exception).

**How to verify:**

1. `npm test` runs `tests/security-headers.test.ts`, which calls
   `proxy()` directly and asserts: a nonce-based, non-unsafe-inline
   `script-src`; `frame-ancestors 'none'`; `base-uri 'self'`; a fresh
   nonce on every call.
2. Manually (the real end-to-end check, not just the unit-level one).
   Must be a **single** request captured to both a headers file and a
   body file -- a fresh nonce is generated on every request, so two
   separate `curl` calls will always "mismatch" even when nothing is
   wrong:
   ```bash
   curl -s -D /tmp/h.txt -o /tmp/b.html "$APP_URL/drops"
   NONCE=$(grep -i content-security-policy /tmp/h.txt | grep -oE 'nonce-[A-Za-z0-9+/=]+' | head -1 | sed 's/nonce-//')
   grep -oE '<script[^>]*>' /tmp/b.html | grep -v "nonce=\"$NONCE\""
   # must print nothing -- every script tag's nonce must match the header's
   ```
   Repeat for every route you add in the future; this is the actual
   contract the nonce mechanism depends on, and it's easy to silently
   break by introducing a new static page.

## Other security headers

**Control:** set in `next.config.ts`'s `headers()` (static, no
per-request value needed, unlike the CSP):

- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY` (redundant with the CSP's `frame-ancestors
  'none'` in modern browsers, kept for older tooling/scanners)

**Where:** `next.config.ts`.

**How to verify:** `npm test` runs the "Static security headers" suite
in `tests/security-headers.test.ts`, which imports `next.config.ts` and
asserts each header's value directly. Manually:
`curl -sI $APP_URL/ | grep -iE "strict-transport|x-content-type|referrer-policy|permissions-policy|x-frame-options"`.

**HTTPS enforcement:** not something application code does -- Vercel
terminates TLS and redirects HTTP→HTTPS automatically for every
deployment; HSTS above is what tells browsers to skip the plaintext
round-trip entirely on subsequent visits.

## Build-time assertion: server-only code never reaches a client bundle

**Control:** every module that reads a server-only secret
(`lib/supabase/admin.ts`, `lib/turnstile.ts`, `lib/rate-limit.ts`,
`lib/email/send-order-confirmation.ts`) starts with `import
"server-only"`. That package resolves to a no-op in a server bundle and
to a module that unconditionally throws in a client one -- Next's
bundler treats this as a hard build error (not a lint warning) the
moment such a module is reachable from a `"use client"` component,
including transitively. `lib/supabase/admin.ts`'s runtime
`typeof window !== "undefined"` check is defense in depth on top of
this, not a substitute -- the build-time check catches the mistake
before any code ships, the runtime check is what happens if it somehow
still got shipped.

**Where:** the `import "server-only"` line at the top of each file
listed above.

**How to verify:**

1. Automated: `npm run build` itself is the test -- if any of those
   modules were ever imported from a client component, the build fails
   with an explicit import trace naming the offending file. There's no
   separate passing/failing test to run; a green build **is** the
   assertion holding.
2. To prove the assertion actually catches something (not just that it
   compiles today): temporarily create a `"use client"` page that
   imports `createAdminClient` from `lib/supabase/admin.ts` and run
   `npm run build` -- it must fail with `Error: 'server-only' cannot be
   imported from a Client Component module` and an import trace. This
   was done during development to confirm the mechanism actually works,
   not just that the import line is present.

## Rate limiting

**Control:** IP-based rate limiting (Upstash Redis, sliding window) on
the three endpoints the brief calls out: checkout-session creation (10/
min/IP), order lookup (5/min/IP -- the hardest limit, since it's the one
enumerable endpoint), and the payment webhook (60/min/IP -- generous,
since a legitimate provider catching up after downtime sends a burst of
retries that must not get throttled into failure). A limited request
gets `429` with a `Retry-After` header; nothing about the response
leaks any information about orders (contrast with the order-lookup
`{"found":false}` responses, which are deliberately uninformative for a
different reason).

**Fails open when unconfigured**, same pattern as Resend/the payment
adapter: if `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` aren't
set, `checkRateLimit` logs a console warning and allows every request.
**This is a real gap if it ships to production unconfigured** -- see the
README deployment checklist, which calls this out explicitly as a
must-configure-before-launch item, not an optional nicety.

**Where:** `lib/rate-limit.ts`, called from `app/checkout/actions.ts`,
`app/api/orders/lookup/route.ts`, `app/api/webhooks/payment/route.ts`.

**How to verify:**

1. `tests/rate-limit.test.ts` covers the IP-extraction logic
   (`x-forwarded-for` first entry, `x-real-ip` fallback, `"unknown"` if
   neither) and the fail-open behavior with no limiter configured
   (exactly the state of this test environment and local dev).
2. Actual blocking behavior needs a real Upstash-backed limiter, which
   this environment doesn't have -- verify manually once
   `UPSTASH_REDIS_REST_URL`/`TOKEN` are configured: script N+1 rapid
   requests to `/api/orders/lookup` from the same IP where N is the
   configured limit, confirm the last one returns 429 with a
   `Retry-After` header.

## Cloudflare Turnstile on order lookup

**Control:** `app/api/orders/lookup/route.ts` requires a valid Turnstile
token (verified server-side against Cloudflare's real `siteverify`
endpoint) before doing anything else with the request -- a missing or
failed token produces the exact same `{"found":false}` response as a
nonexistent order, keeping the anti-enumeration property intact (a bot
probing the endpoint can't distinguish "you're not human" from "that
order doesn't exist" from "that email doesn't match").

**No fail-open/skip-if-unconfigured path**, unlike Resend/Upstash --
Cloudflare publishes real, live test key pairs specifically for local
dev/testing without a Cloudflare account (see `.env.example`), so
there's no scenario where Turnstile verification needs to be bypassed.
An empty/missing secret or token is treated as verification failure.

**Where:** `lib/turnstile.ts` (verification), `app/api/orders/lookup/route.ts`
(enforcement), `components/OrderLookupForm.tsx` (widget, explicit-render
mode so it plays correctly with React instead of implicit auto-render
fighting the virtual DOM), `app/orders/lookup/page.tsx` (reads the CSP
nonce via `headers()` and passes it to the Turnstile `<Script>` tag --
required, since `script-src` has no exception and the widget script
must carry a valid nonce like every other script on the site).

**How to verify:**

1. `tests/turnstile.test.ts` calls `verifyTurnstileToken` against the
   real Cloudflare endpoint with both published test secrets --
   Cloudflare's "always passes" pair returns `true`, the "always fails"
   pair returns `false`, and a missing token/secret both fail closed.
   `tests/order-lookup.test.ts` confirms a missing `turnstileToken`
   produces the same generic `{"found":false}` as every other rejection
   path.
2. Manually: load `/orders/lookup` in a real browser with real
   Turnstile keys configured and confirm the widget renders and the
   submit button is disabled until it completes.

## Output escaping: no dangerouslySetInnerHTML, sanitized free text

**Control:** `eslint.config.mjs` sets `react/no-danger` to `error`,
banning `dangerouslySetInnerHTML` outright rather than reviewing it
case by case (verified during the security-headers step: a scratch
component using it was confirmed to fail lint, then deleted). Every
customer-supplied free-text field (shipping name/address, order note)
is capped at a fixed length by its zod schema
(`lib/checkout.ts`'s `checkoutFormSchema`) and rendered exclusively
through paths that escape it: React's default JSX escaping everywhere
it reaches a page, and an explicit `escapeHtml()` function
(`lib/email/order-confirmation.ts`) everywhere it reaches the HTML
email template. Nothing sanitizes by *stripping* characters at input
time -- that's deliberate, not an oversight: escaping correctly at
every output site is the actually-correct defense (it's what "React
escapes output by default" in the brief is describing), and stripping
at input time is a common source of subtle bugs (double-encoding,
losing legitimate characters, or missing an output site the stripping
didn't anticipate) without adding real protection on top of consistent
output escaping.

**Where:** `eslint.config.mjs` (`react/no-danger`), `lib/checkout.ts`
(length caps), `lib/email/order-confirmation.ts` (`escapeHtml`).

**How to verify:**

1. `grep -rn dangerouslySetInnerHTML app components lib` should return
   nothing; `npm run lint` enforces this on every push regardless.
2. `tests/order-confirmation-email.test.ts`'s escaping test: builds an
   email with a shipping name of `<script>alert("x")</script>` and
   asserts the HTML output contains `&lt;script&gt;`, never a literal
   `<script>` tag.
3. Manually: submit a checkout with a shipping name containing HTML
   special characters and confirm it displays as literal text
   everywhere it's shown (checkout confirmation, order lookup, email).

## Dependencies

**Control:** `.github/workflows/ci.yml` runs `npm audit --audit-level=high`
on every push/PR, in addition to lint and build. `.github/dependabot.yml`
opens weekly PRs for outdated npm packages and GitHub Actions.
`package-lock.json` is committed (already true from the first commit --
`npm install` always produces one) and dependency versions are pinned in
`package.json` the way `npm install <pkg>` leaves them by default (caret
ranges resolved and locked via the committed lockfile), not loosened.

**Not yet wired into CI:** the RLS/no-oversell/webhook/order-lookup test
suite, since it needs a live local Supabase stack (Postgres + PostgREST
via Docker), which adds real setup complexity to a GitHub Actions job.
`ci.yml`'s build job runs with dummy Supabase env vars just to prove the
app compiles; it does not exercise the database-backed tests. Run those
locally per this README until that gap is closed.

**Where:** `.github/workflows/ci.yml`, `.github/dependabot.yml`.

**How to verify:** check the "Actions" tab on the repo after any push --
both the `gitleaks` and `CI` workflows should be green.
`npm audit --audit-level=high` locally should print `found 0
vulnerabilities` (or whatever the current count is, if a new advisory
has landed since this was written).

## Load test: never oversell holds under real HTTP, not just at the database layer

**Control:** `load-test/checkout.js` (k6) confirms the same result as
`tests/no-oversell.test.ts` -- exactly N reservations succeed against N
units of stock, zero oversold -- but through the real HTTP stack
(Next.js Server Action, PostgREST, the whole path a real buyer's browser
takes), not by calling the Postgres function directly. Run against this
project's own local stack with 200 concurrent virtual users and 30 units
of stock: 30 reserved, 170 correctly told the size was sold out, 0
oversold, 0 unexpected outcomes.

**Where:** `load-test/checkout.js`, `scripts/seed-load-test.mjs`.

**How to verify:** see README's "Load testing" section for the exact
commands. That section is also unusually candid about a limitation: the
p95 latency numbers measured in the sandbox this project was built in
are not representative of Vercel production (single-process queuing
artifact, load generator sharing the same CPU as the server under test)
-- re-run against a real Vercel deployment before the first real drop,
which this build environment cannot do itself.
