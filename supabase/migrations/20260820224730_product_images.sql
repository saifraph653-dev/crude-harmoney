-- Product photos are static assets shipped in the repo under /public
-- (v1 has no file uploads and no CMS), so this column stores a root-relative
-- path like '/products/midnight-hoodie/front.jpg', not an uploaded blob.
alter table products
  add column image_path text,
  add column image_width integer,
  add column image_height integer;

alter table products
  add constraint products_image_dimensions_check
  check (
    (image_path is null and image_width is null and image_height is null)
    or (image_path is not null and image_width > 0 and image_height > 0)
  );

-- Sizes don't sort correctly as text (S, M, L, XL alphabetizes to L, M, S, XL).
-- The seed script sets this explicitly; defaults to 0 so it's never null.
alter table variants
  add column sort_order integer not null default 0;
