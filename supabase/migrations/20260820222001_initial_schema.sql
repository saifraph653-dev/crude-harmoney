-- Crude Harmony: initial schema
-- Money is stored as integer minor units (fils; 1 QAR = 100 fils) to avoid
-- floating point arithmetic anywhere near a price or a total.

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'live', 'ended')),
  currency text not null default 'QAR' check (currency = 'QAR'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- variants
-- ---------------------------------------------------------------------------
create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  size text not null,
  sku text not null unique,
  price_cents integer not null check (price_cents > 0),
  stock_count integer not null default 0 check (stock_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, size)
);

create trigger variants_set_updated_at
  before update on variants
  for each row execute function set_updated_at();

create index variants_product_id_idx on variants(product_id);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create sequence order_number_seq;

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique
    default ('CH-' || lpad(nextval('order_number_seq')::text, 6, '0')),
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'fulfilled', 'cancelled', 'expired')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'QAR' check (currency = 'QAR'),
  shipping_name text not null,
  shipping_address_line1 text not null,
  shipping_address_line2 text not null default '',
  shipping_city text not null,
  shipping_country text not null,
  shipping_postal_code text not null default '',
  note text not null default '',
  payment_provider text,
  payment_provider_session_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

create index orders_email_idx on orders(email);
create index orders_payment_provider_session_id_idx on orders(payment_provider_session_id);

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid not null references variants(id),
  product_name_snapshot text not null,
  variant_size_snapshot text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on order_items(order_id);
create index order_items_variant_id_idx on order_items(variant_id);

-- ---------------------------------------------------------------------------
-- stock_reservations
--
-- A reservation records a *temporary* decrement of variants.stock_count that
-- has already happened. The expiry cron restores stock_count for rows still
-- 'active' past expires_at; the webhook handler marks a reservation
-- 'consumed' on payment success (the decrement becomes permanent).
-- ---------------------------------------------------------------------------
create table stock_reservations (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references variants(id),
  order_id uuid references orders(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'active'
    check (status in ('active', 'released', 'consumed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index stock_reservations_variant_id_idx on stock_reservations(variant_id);
create index stock_reservations_order_id_idx on stock_reservations(order_id);
create index stock_reservations_active_expiry_idx
  on stock_reservations(expires_at)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- webhook_events
--
-- Idempotency ledger for payment provider webhooks. The unique index on
-- (provider, event_id) is the insert-or-ignore guard: insert first, and if
-- the insert is ignored because the row already exists, the event has
-- already been processed and must not be processed again.
-- ---------------------------------------------------------------------------
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'failed')),
  error_message text,
  unique (provider, event_id)
);
