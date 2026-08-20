-- Local dev / preview seed data, applied automatically by
-- `supabase start` / `supabase db reset`. Not meant for production --
-- the real seed workflow (task: seed script) lands separately and can
-- supersede this file.
insert into products (slug, name, description, status, image_path, image_width, image_height)
values (
  'midnight-hoodie',
  'Midnight Hoodie',
  'Heavyweight fleece, boxy fit. 30 units, one drop.',
  'live',
  '/products/placeholder.svg',
  800,
  800
);

insert into variants (product_id, size, sku, price_cents, stock_count, sort_order)
select id, size, sku, price_cents, stock_count, sort_order
from products
cross join (
  values
    ('S', 'MH-S', 28000, 6, 1),
    ('M', 'MH-M', 28000, 10, 2),
    ('L', 'MH-L', 28000, 10, 3),
    ('XL', 'MH-XL', 28000, 4, 4)
) as v(size, sku, price_cents, stock_count, sort_order)
where products.slug = 'midnight-hoodie';
