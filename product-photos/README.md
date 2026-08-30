# Product photography — Crude Harmony

Photoreal flat-lay shots replacing the flat vector clip-art product art.
Six pieces: 2 Limited (Ember 01, Obsidian 02), 4 Classic (Atlas, Meridian, Dune, Vale).

## What ships

The live art is `public/products/*.svg`. Each is a 1000x1000 SVG wrapping the
photograph as an embedded JPEG, keeping the exact filenames, dimensions and
extensions the app already uses — so no code change and no Supabase change is
needed. `image_path`/`image_width`/`image_height` come from the database
(`lib/products.ts`), so changing extensions would have meant a data migration;
this avoids that entirely.

| Piece | Garment | Ink | Graphic | Deployed file |
|---|---|---|---|---|
| Ember 01 | deep red | cream-white | winged dagger + ONE OF THIRTY | `public/products/ember-tee.svg` |
| Obsidian 02 | black | muted gold | crown + NO RESTOCK | `public/products/obsidian-tee.svg` |
| Atlas Tee | black | lavender-white | cross + CRUDE HARMONY | `public/products/atlas-tee.svg` |
| Meridian Tee | off-white cream | black-charcoal | dagger + SINCE THE FIRST RUN | `public/products/meridian-tee.svg` |
| Dune Tee | tan sand | dark brown | four-point star | `public/products/dune-tee.svg` |
| Vale Tee | charcoal grey | lavender-white | open hand + CRUDE HARMONY | `public/products/vale-tee.svg` |

`slate-tee.svg` is a byte-copy of `vale-tee.svg`. Production currently serves
`/products/slate-tee.svg` (it runs the commit before "Replace Slate Tee with Vale
Tee"), and `image_path` lives in Supabase rather than in the code, so the duplicate
guarantees the sixth Classic piece renders whichever name the database holds.
Delete it once the DB is confirmed to point at `vale-tee.svg`.

## Framing

`.card-frame` is `aspect-ratio: 1/1` and the `next/image` calls use `object-cover`,
so the grid and the product page both crop to a square. The shipped files are
pre-cropped to that square — identical to what the browser would do to a 4:5 file,
but without relying on it. Masters stay in `out/` at the full 1632x2048 4:5 frame
if a taller crop is ever wanted.

## Consistency

All six render from one `style_template` in `shoot.json`, so camera, lighting,
fabric and print language are identical; only garment colour, surface, light
quality, ink tone and emblem vary. Same model (Bloom `pro`), same settings.

The template pins what the old art got wrong:

- **Photograph, not illustration** — named camera, 85mm lens, f/4, straight-down.
- **Real fabric** — cotton weave, natural wrinkles, ribbed collar, stitched hems.
- **Print sits ON the cloth** — follows the wrinkles and weave, matte vinyl sheen,
  softly creased edges, so it does not float flat above the shirt.
- **Heat-pressable** — one flat ink tone, no gradients, no shading, no fine detail.
- **Clean frame** — no hangtags, neck labels, logos, watermarks, props or stray text.

References were left empty and the brand was onboarded with `collect_images: false`:
the existing library is the flat vector look being replaced, so feeding it back
would reintroduce it.

## Emblem wording — needed a second pass

First pass, three emblems collapsed into a plain cross: the daggers on Ember 01 and
Meridian (a dagger's crossguard makes that an easy slip) and the open hand on Vale.
Naming the emblem was not enough. The fix was spelling out the geometry — blade
tapering to a point, handle, pommel, wings spreading from the handle top — and
naming the failure directly with "NOT as a cross, crucifix or plus sign". Keep that
wording for any future dagger or hand mark.

## Files

- `shoot.json` — shared style template, per-piece variables, Bloom image IDs.
- `PROMPTS.md` — the six rendered prompts.
- `out/` — masters, 1632x2048 4:5 (q92 JPEG; the repo is an app repo, so the
  ~37MB of source PNGs was not worth committing).
- `square/` — the 1000x1000 crops embedded in the shipped SVGs.
