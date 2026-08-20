# Security controls

Every control below maps to a requirement from the project brief. Each entry
says what it is, where it lives, and exactly how to re-verify it yourself
later. This file grows as the build proceeds; sections for later steps
(webhooks, headers, rate limiting, etc.) are added when those steps land.

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

**Control:** every route handler validates its input with zod `.strict()`
before touching the database, per the project's blanket rule ("validate
every server action and route handler input with zod"). `app/api/stock/route.ts`
rejects anything that isn't 1-50 comma-separated UUIDs with a 400, before
any query runs.

**Where:** `app/api/stock/route.ts`.

**How to verify:**

```bash
curl -i "$APP_URL/api/stock?variantIds=not-a-uuid"   # 400
curl -i "$APP_URL/api/stock"                          # 400, missing param
curl -i "$APP_URL/api/stock?variantIds=$REAL_UUID"    # 200
```

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
