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
