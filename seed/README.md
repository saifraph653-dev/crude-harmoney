# seed/products.json

This file is the product-entry workflow: there is no CMS and no admin UI by
design. `node scripts/seed-products.mjs` reads it and inserts anything whose
slug does not already exist.

## Before this runs against a database that has the old range

`seed-products.mjs` **skips existing slugs and never deletes**, deliberately,
so it will not clean up after the previous collection. The old six
(`atlas-tee`, `meridian-tee`, `dune-tee`, `vale-tee`, `ember-01`,
`obsidian-02`) still hold `image_path` values pointing at
`/products/*.svg` files that no longer exist, so until they are removed the
storefront will render broken images for them.

Delete those six rows in the Supabase dashboard (Table Editor -> products;
variants cascade) before or after seeding this file. Do not do it with a
re-run of the seed script.

## What still needs your input

Two things here are placeholders, marked so you can find them rather than
left to look like facts:

- **Prices.** 180.00 QAR for the tees, 320.00 QAR for the hoodies, carried
  over from the previous range's tee pricing and scaled for a heavier
  garment. These are not costed against real blanks or transfer costs.
- **Stock counts.** 10/16/16/10 per size. Placeholder run sizes, not a
  counted edition you have committed to.

Deliberately **absent** rather than guessed: hoodie fabric weight and
composition, fit measurements, and care instructions. The tee descriptions
carry the 240gsm combed cotton line the storefront already states; the
hoodie descriptions say nothing about fabric because no blank has been
chosen. Fill those in once you have picked a supplier -- do not let them
ship as invented specification.
