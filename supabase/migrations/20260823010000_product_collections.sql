-- Collections: the storefront groups drops into a permanent "Classic"
-- range and rotating "Limited" editions. This is a presentation grouping
-- only -- it deliberately carries no pricing, stock or fulfilment
-- behaviour, so nothing in the checkout path has to branch on it.
alter table products
  add column collection text not null default 'classic'
    check (collection in ('classic', 'limited'));

-- Explicit merchandising order for the grid. Products don't have a
-- natural sort (created_at ties when a whole range is seeded in one run),
-- and alphabetical would be arbitrary.
alter table products
  add column display_order integer not null default 0;

create index products_collection_idx on products(collection);
