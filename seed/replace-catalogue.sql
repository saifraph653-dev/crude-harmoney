-- Replace the catalogue with Vol. 01.
--
-- Paste into the Supabase dashboard -> SQL Editor -> New query -> Run.
-- One transaction: either the whole swap happens or none of it.
--
-- Until this runs the storefront shows the previous range's vector
-- illustrations. The images are chosen by the products.image_path values
-- held in this table, not by the code, so shipping new image files alone
-- changes nothing.

begin;

-- Old range. order_items carry their own price and name snapshots, so any
-- historical order stays readable; variants cascade with the product.
delete from products where slug in (
  'atlas-tee', 'meridian-tee', 'dune-tee', 'vale-tee', 'ember-01', 'obsidian-02'
);

insert into products
  (slug, name, description, status, collection, display_order, image_path, image_width, image_height)
values
  ('arc-tee', 'Arc Tee', 'Arched wordmark across the back with DOHA beneath, small CH at the left chest. Washed-black heavyweight cotton, oversized boxy fit, dropped shoulders. Shown as a concept render; the first run has not been produced yet.', 'coming_soon', 'classic', 1, '/products/arc-tee.jpg', 1400, 1757),
  ('monogram-tee', 'Monogram Tee', 'The CH mark set large across the back over DOHA · QATAR, small wordmark at the left chest. Vintage off-white heavyweight cotton, oversized boxy fit. Shown as a concept render; the first run has not been produced yet.', 'coming_soon', 'classic', 2, '/products/monogram-tee.jpg', 1400, 1757),
  ('arc-hoodie', 'Arc Hoodie', 'Arched wordmark over the CH mark across the back, small CH at the left chest. Washed-black heavyweight cotton, boxy fit, ribbed cuffs and hem. Shown as a concept render; the first run has not been produced yet.', 'coming_soon', 'classic', 3, '/products/arc-hoodie.jpg', 1400, 1757),
  ('stack-hoodie', 'Stack Hoodie', 'Wordmark stacked and set flush left across the back with DOHA — QATAR beneath, small wordmark at the left chest. Charcoal heavyweight cotton, boxy fit. Shown as a concept render; the first run has not been produced yet.', 'coming_soon', 'classic', 4, '/products/stack-hoodie.jpg', 1400, 1757),
  ('line-tee', 'Line Tee — Women''s', 'Wordmark set between two rules high on the back, small CH at the left chest. Vintage cream cotton, boxy cropped cut with a straight hem. Shown as a concept render; the first run has not been produced yet.', 'coming_soon', 'classic', 5, '/products/line-tee.jpg', 1400, 1757),
  ('monogram-hoodie', 'Monogram Hoodie — Women''s', 'The CH mark across the back, small wordmark at the left chest. Heather grey cotton, relaxed cropped cut, ribbed cuffs and hem. Shown as a concept render; the first run has not been produced yet.', 'coming_soon', 'classic', 6, '/products/monogram-hoodie.jpg', 1400, 1757);

-- Variants, matched back to their product by slug.
insert into variants (product_id, size, sku, price_cents, stock_count, sort_order)
select p.id, v.size, v.sku, v.price_cents, v.stock_count, v.sort_order
from products p
join (values
  ('arc-tee', 'S', 'CH-ARC-S', 18000, 10, 1),
  ('arc-tee', 'M', 'CH-ARC-M', 18000, 16, 2),
  ('arc-tee', 'L', 'CH-ARC-L', 18000, 16, 3),
  ('arc-tee', 'XL', 'CH-ARC-XL', 18000, 10, 4),
  ('monogram-tee', 'S', 'CH-MON-S', 18000, 10, 1),
  ('monogram-tee', 'M', 'CH-MON-M', 18000, 16, 2),
  ('monogram-tee', 'L', 'CH-MON-L', 18000, 16, 3),
  ('monogram-tee', 'XL', 'CH-MON-XL', 18000, 10, 4),
  ('arc-hoodie', 'S', 'CH-ARH-S', 32000, 10, 1),
  ('arc-hoodie', 'M', 'CH-ARH-M', 32000, 16, 2),
  ('arc-hoodie', 'L', 'CH-ARH-L', 32000, 16, 3),
  ('arc-hoodie', 'XL', 'CH-ARH-XL', 32000, 10, 4),
  ('stack-hoodie', 'S', 'CH-STK-S', 32000, 10, 1),
  ('stack-hoodie', 'M', 'CH-STK-M', 32000, 16, 2),
  ('stack-hoodie', 'L', 'CH-STK-L', 32000, 16, 3),
  ('stack-hoodie', 'XL', 'CH-STK-XL', 32000, 10, 4),
  ('line-tee', 'S', 'CH-LIN-S', 18000, 10, 1),
  ('line-tee', 'M', 'CH-LIN-M', 18000, 16, 2),
  ('line-tee', 'L', 'CH-LIN-L', 18000, 16, 3),
  ('line-tee', 'XL', 'CH-LIN-XL', 18000, 10, 4),
  ('monogram-hoodie', 'S', 'CH-MNH-S', 32000, 10, 1),
  ('monogram-hoodie', 'M', 'CH-MNH-M', 32000, 16, 2),
  ('monogram-hoodie', 'L', 'CH-MNH-L', 32000, 16, 3),
  ('monogram-hoodie', 'XL', 'CH-MNH-XL', 32000, 10, 4)
) as v(slug, size, sku, price_cents, stock_count, sort_order)
  on v.slug = p.slug;

commit;

