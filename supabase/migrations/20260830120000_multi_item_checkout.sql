-- Multi-item checkout.
--
-- reserve_stock_and_create_order() takes one variant and one quantity, so
-- an order could only ever hold a single line. order_items and
-- stock_reservations were already modelled as separate tables keyed by
-- order_id, so the schema always allowed more; only the entry point did
-- not. This adds a bag-shaped entry point beside it.
--
-- The single-item function is deliberately left in place and unchanged.
-- It is the most safety-critical code in the project and it is covered by
-- tests/no-oversell.test.ts; replacing it in the same change as adding a
-- cart would put the counted-run guarantee and a new feature on the same
-- roll of the dice.

create or replace function reserve_stock_and_create_order_multi(
  p_items jsonb,
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
  v_line record;
  v_currency text;
  v_subtotal integer := 0;
  v_total_qty integer := 0;
  v_order_id uuid;
  v_order_number text;
  v_line_count integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_input';
  end if;

  -- Collapse duplicate variants and fix a deterministic processing order.
  --
  -- The ordering is not cosmetic. Two customers checking out the same two
  -- variants in opposite orders would take row locks in opposite orders
  -- and deadlock; sorting by variant_id means every caller in the system
  -- takes them in the same sequence, so they queue instead.
  create temp table if not exists _bag (
    variant_id uuid primary key,
    quantity integer not null
  ) on commit drop;
  delete from _bag;

  insert into _bag (variant_id, quantity)
  select (item->>'variant_id')::uuid, sum((item->>'quantity')::integer)
  from jsonb_array_elements(p_items) as item
  group by (item->>'variant_id')::uuid;

  select count(*), coalesce(sum(quantity), 0) into v_line_count, v_total_qty from _bag;

  -- Same ceiling the single-item path enforces, applied to the whole bag
  -- rather than per line, so five lines of five is not a way around it.
  if v_total_qty < 1 or v_total_qty > 5 then
    raise exception 'invalid_quantity';
  end if;
  if v_line_count > 5 then
    raise exception 'invalid_quantity';
  end if;
  if exists (select 1 from _bag where quantity < 1) then
    raise exception 'invalid_quantity';
  end if;

  insert into orders as o (
    email, status, subtotal_cents, total_cents, currency,
    shipping_name, shipping_address_line1, shipping_address_line2,
    shipping_city, shipping_country, shipping_postal_code, note
  ) values (
    lower(p_email), 'pending', 0, 0, 'QAR',
    p_shipping_name, p_shipping_address_line1, coalesce(p_shipping_address_line2, ''),
    p_shipping_city, p_shipping_country, coalesce(p_shipping_postal_code, ''), coalesce(p_note, '')
  )
  returning o.id, o.order_number into v_order_id, v_order_number;

  for v_line in
    select b.variant_id, b.quantity from _bag b order by b.variant_id
  loop
    -- Reclaim this variant's lapsed reservations first, exactly as the
    -- single-item path does, so availability is correct regardless of how
    -- often the release cron has run.
    perform release_expired_reservations(v_line.variant_id);

    declare
      v_status text;
      v_name text;
      v_cur text;
      v_size text;
      v_price integer;
    begin
      select p.status, p.name, p.currency, v.size, v.price_cents
        into v_status, v_name, v_cur, v_size, v_price
      from variants v
      join products p on p.id = v.product_id
      where v.id = v_line.variant_id;

      if not found then
        raise exception 'variant_not_found';
      end if;
      if v_status <> 'live' then
        raise exception 'product_not_live';
      end if;

      -- One currency per order: totals are a single integer column, so a
      -- mixed-currency bag would silently add fils to something else.
      if v_currency is null then
        v_currency := v_cur;
      elsif v_currency <> v_cur then
        raise exception 'invalid_input';
      end if;

      -- The statement the whole function exists to protect: never read
      -- stock_count and decide in application code, always let this WHERE
      -- clause be the decision.
      update variants
      set stock_count = stock_count - v_line.quantity
      where id = v_line.variant_id
        and stock_count >= v_line.quantity;

      if not found then
        raise exception 'insufficient_stock';
      end if;

      insert into order_items (
        order_id, variant_id, product_name_snapshot, variant_size_snapshot,
        unit_price_cents, quantity
      ) values (
        v_order_id, v_line.variant_id, v_name, v_size, v_price, v_line.quantity
      );

      insert into stock_reservations (variant_id, order_id, quantity, status, expires_at)
      values (v_line.variant_id, v_order_id, v_line.quantity, 'active', now() + interval '15 minutes');

      v_subtotal := v_subtotal + (v_price * v_line.quantity);
    end;
  end loop;

  update orders
  set subtotal_cents = v_subtotal, total_cents = v_subtotal, currency = v_currency
  where id = v_order_id;

  return query select v_order_id, v_order_number, v_subtotal, v_currency;
end;
$$;

revoke all on function reserve_stock_and_create_order_multi(
  jsonb, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
