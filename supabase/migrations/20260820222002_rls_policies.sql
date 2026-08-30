-- Crude Harmony: Row Level Security
--
-- Default-deny: RLS is enabled on every table with no policy for anon or
-- authenticated unless explicitly created below. `service_role` (used only
-- from server-side code, never shipped to the browser) has BYPASSRLS on
-- Supabase and is unaffected by any policy here; it is the only role
-- allowed to write orders, order_items, stock_reservations and
-- webhook_events.
--
-- Explicit GRANTs are required in addition to RLS policies: recent
-- Supabase projects (see supabase/config.toml `auto_expose_new_tables`)
-- do not auto-expose new tables to the anon/authenticated Data API roles,
-- so a table with no GRANT is invisible to PostgREST regardless of RLS.
-- We rely on that as defense in depth, and still enable RLS everywhere
-- per the "never trust just one layer" rule.

-- ---------------------------------------------------------------------------
-- products — readable by anon/authenticated once live or ended, never while
-- draft (a drop that hasn't been announced yet should not be fetchable by
-- guessing its slug).
-- ---------------------------------------------------------------------------
alter table products enable row level security;

grant select on products to anon, authenticated;

create policy "products_public_read"
  on products
  for select
  to anon, authenticated
  using (status in ('live', 'ended'));

-- ---------------------------------------------------------------------------
-- variants — readable by anon/authenticated only for a visible parent
-- product, same rule as above.
-- ---------------------------------------------------------------------------
alter table variants enable row level security;

grant select on variants to anon, authenticated;

create policy "variants_public_read"
  on variants
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from products p
      where p.id = variants.product_id
        and p.status in ('live', 'ended')
    )
  );

-- ---------------------------------------------------------------------------
-- orders — never readable by anon/authenticated. Order lookup by
-- order number + email goes through a server route using the service-role
-- key, which bypasses RLS entirely.
-- ---------------------------------------------------------------------------
alter table orders enable row level security;

-- ---------------------------------------------------------------------------
-- order_items — same as orders.
-- ---------------------------------------------------------------------------
alter table order_items enable row level security;

-- ---------------------------------------------------------------------------
-- stock_reservations — same as orders. Never exposed to the client; the
-- client only ever learns "in stock" / "sold out" via the variants read
-- above, which reflects stock_count net of active reservations.
-- ---------------------------------------------------------------------------
alter table stock_reservations enable row level security;

-- ---------------------------------------------------------------------------
-- webhook_events — internal idempotency ledger. Never exposed to any
-- client role.
-- ---------------------------------------------------------------------------
alter table webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- service_role: explicit full access, spelled out rather than assumed.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on
  products, variants, orders, order_items, stock_reservations, webhook_events
  to service_role;

grant usage, select on sequence order_number_seq to service_role;
