-- Atomic checkout: reserve stock and create an order in one transaction.
--
-- The only place stock_count ever changes is the conditional UPDATE below
-- (WHERE stock_count >= quantity) and the mirror-image UPDATE in
-- release_expired_reservations(). Every other statement in this function
-- is metadata (orders/order_items/stock_reservations) that follows from
-- that one atomic decrement -- if the decrement's WHERE clause matches
-- zero rows, the whole function raises and the transaction rolls back,
-- so no order or reservation is ever created without real stock behind it.

create or replace function release_expired_reservations(p_variant_id uuid default null)
returns integer
language plpgsql
as $$
declare
  v_released_count integer;
begin
  with released as (
    update stock_reservations
    set status = 'released'
    where status = 'active'
      and expires_at < now()
      and (p_variant_id is null or variant_id = p_variant_id)
    returning id, variant_id, quantity, order_id
  ),
  restock_totals as (
    select variant_id, sum(quantity) as total_qty
    from released
    group by variant_id
  ),
  restocked as (
    update variants v
    set stock_count = v.stock_count + t.total_qty
    from restock_totals t
    where v.id = t.variant_id
    returning v.id
  ),
  expired_orders as (
    update orders o
    set status = 'expired'
    where o.id in (select order_id from released)
      and o.status = 'pending'
    returning o.id
  )
  select count(*) into v_released_count from released;

  return coalesce(v_released_count, 0);
end;
$$;

revoke all on function release_expired_reservations(uuid) from public;
grant execute on function release_expired_reservations(uuid) to service_role;

create or replace function reserve_stock_and_create_order(
  p_variant_id uuid,
  p_quantity integer,
  p_email text,
  p_shipping_name text,
  p_shipping_address_line1 text,
  p_shipping_address_line2 text,
  p_shipping_city text,
  p_shipping_country text,
  p_shipping_postal_code text,
  p_note text
)
returns table (order_id uuid, order_number text, total_cents integer, currency text)
language plpgsql
as $$
declare
  v_product_status text;
  v_product_name text;
  v_currency text;
  v_size text;
  v_price_cents integer;
  v_new_stock_count integer;
  v_order_id uuid;
  v_order_number text;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 5 then
    raise exception 'invalid_quantity';
  end if;

  -- Reclaim this variant's lapsed reservations before checking
  -- availability. This is what makes correctness independent of how
  -- often the Vercel Cron release job runs (Hobby-plan cron can be up to
  -- 24h between invocations) -- the cron keeps *displayed* stock counts
  -- fresh for browsers who aren't buying, this makes a real purchase
  -- attempt always see accurate availability regardless of cron cadence.
  perform release_expired_reservations(p_variant_id);

  select p.status, p.name, p.currency, v.size, v.price_cents
    into v_product_status, v_product_name, v_currency, v_size, v_price_cents
  from variants v
  join products p on p.id = v.product_id
  where v.id = p_variant_id;

  if not found then
    raise exception 'variant_not_found';
  end if;

  if v_product_status <> 'live' then
    raise exception 'product_not_live';
  end if;

  -- The one statement this whole function exists to protect: never read
  -- stock_count and decide in application code, always let this WHERE
  -- clause be the decision.
  update variants
  set stock_count = stock_count - p_quantity
  where id = p_variant_id
    and stock_count >= p_quantity
  returning stock_count into v_new_stock_count;

  if not found then
    raise exception 'insufficient_stock';
  end if;

  -- Aliased and qualified in the RETURNING clause: this function's
  -- `returns table (order_id, order_number, ...)` clause implicitly
  -- declares PL/pgSQL variables of those names, which would otherwise
  -- make `order_number` ambiguous against the orders.order_number column.
  insert into orders as o (
    email, status, subtotal_cents, total_cents, currency,
    shipping_name, shipping_address_line1, shipping_address_line2,
    shipping_city, shipping_country, shipping_postal_code, note
  ) values (
    lower(p_email), 'pending', v_price_cents * p_quantity, v_price_cents * p_quantity, v_currency,
    p_shipping_name, p_shipping_address_line1, coalesce(p_shipping_address_line2, ''),
    p_shipping_city, p_shipping_country, coalesce(p_shipping_postal_code, ''), coalesce(p_note, '')
  )
  returning o.id, o.order_number into v_order_id, v_order_number;

  insert into order_items (
    order_id, variant_id, product_name_snapshot, variant_size_snapshot, unit_price_cents, quantity
  ) values (
    v_order_id, p_variant_id, v_product_name, v_size, v_price_cents, p_quantity
  );

  insert into stock_reservations (variant_id, order_id, quantity, status, expires_at)
  values (p_variant_id, v_order_id, p_quantity, 'active', now() + interval '10 minutes');

  return query select v_order_id, v_order_number, v_price_cents * p_quantity, v_currency;
end;
$$;

revoke all on function reserve_stock_and_create_order(
  uuid, integer, text, text, text, text, text, text, text, text
) from public;
grant execute on function reserve_stock_and_create_order(
  uuid, integer, text, text, text, text, text, text, text, text
) to service_role;
