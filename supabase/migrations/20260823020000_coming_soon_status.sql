-- Pre-launch: a product needs to be publicly visible as a lookbook piece
-- WITHOUT being purchasable. 'draft' hides it entirely and 'live' opens
-- checkout, so neither fits; this adds a third public-but-not-for-sale
-- state in between.
--
-- Nothing in the purchase path is widened by this. reserve_stock_and_
-- create_order() still requires status = 'live' exactly, so a
-- 'coming_soon' product cannot be reserved even if someone posts a
-- variant id straight at the checkout action.

alter table products
  drop constraint if exists products_status_check;

alter table products
  add constraint products_status_check
  check (status in ('draft', 'coming_soon', 'live', 'ended'));

-- Widen the public read policies to include the new state. These are the
-- only two tables anon can read at all; orders/reservations stay closed.
drop policy if exists "products_public_read" on products;
create policy "products_public_read"
  on products
  for select
  to anon, authenticated
  using (status in ('coming_soon', 'live', 'ended'));

drop policy if exists "variants_public_read" on variants;
create policy "variants_public_read"
  on variants
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from products p
      where p.id = variants.product_id
        and p.status in ('coming_soon', 'live', 'ended')
    )
  );
