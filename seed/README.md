# seed/products.json

This file is the product-entry workflow: there is no CMS and no admin UI by
design. `node scripts/seed-products.mjs` reads it and inserts anything whose
slug does not already exist.

## The database still holds the previous range

The storefront is live with the new design, but the catalogue it renders
still comes from the database, and the database still holds the previous six
products (`atlas-tee`, `meridian-tee`, `dune-tee`, `vale-tee`, `ember-01`,
`obsidian-02`). Until they are replaced, the site shows the old range.

`public/products/*.svg` for those six are kept in the repository purely so
that stays *working* rather than broken — deleting them 404s every product
image in production. They are not part of the new collection and should go
once the catalogue is swapped.

To swap the catalogue:

1. Delete the six old rows in the Supabase dashboard (Table Editor ->
   products; variants and order_items cascade). Do not attempt this by
   re-running the seed script — it skips existing slugs and never deletes,
   deliberately, so it cannot reset stock on something that has sold.
2. Run `node scripts/seed-products.mjs` with `.env.local` pointing at
   production.
3. Delete the six old `public/products/*.svg` files, which are then unused.

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
chosen. Fill those in once you have picked a supplier — do not let them ship
as invented specification.

## Environment

`NEXT_PUBLIC_SITE_URL` is currently set in Vercel to the project's
`.vercel.app` domain, so canonical URLs, OpenGraph tags and the sitemap all
advertise that address instead of `crudeharmony.com`. Set it to
`https://crudeharmony.com` in the Vercel project's environment variables and
redeploy. It also feeds the payment provider's success/cancel URLs, so it
should be the real domain before anything takes money.
