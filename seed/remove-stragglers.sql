-- Remove anything that is not part of Vol. 01.
--
-- Paste into the Supabase dashboard -> SQL Editor -> New query -> Run.
--
-- replace-catalogue.sql named the six rows to delete, and missed one: the
-- sixth piece of the previous range was 'slate-tee' in the database while
-- the branch that list was read from called it 'vale-tee'. It survived, and
-- its image file no longer exists, so it renders as a broken tile.
--
-- This is an allow-list instead. Anything whose slug is not one of the six
-- current pieces goes, so no straggler can survive a future swap either.
begin;

delete from products
where slug not in (
  'arc-tee', 'monogram-tee', 'arc-hoodie',
  'stack-hoodie', 'line-tee', 'monogram-hoodie'
);

commit;
