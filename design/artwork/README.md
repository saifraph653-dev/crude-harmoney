# Artwork pipeline

Offline design tooling. **Not part of the application build** — nothing in
`app/`, `lib/` or `components/` imports any of this, and it adds no
dependency to `package.json`. It is here so the collection's artwork can be
edited and regenerated rather than existing only as flattened pixels.

## Why it exists

The previous version of this collection was produced by describing a graphic
to an image model and accepting what came back. That is why it read as
generic: the model was doing the design. Here the layouts are specified — in
CSS, with the brand's own typeface — and a browser renders them exactly.
The image model is used only to photograph *blank* garments, which is a
thing it is reliably good at.

## Running it

Requires Python with `playwright` and `pillow`, and a Chromium Playwright
can launch. Neither is needed to build or run the site.

```
python3 design/artwork/render.py      # artwork -> /tmp/art
python3 design/artwork/composite.py   # artwork onto blanks -> /tmp/mockups
```

`render.py` holds the actual designs: the back graphic and front mark for
each of the six pieces, as HTML and CSS. Editing a layout means editing it
there. Output is trimmed to its own ink so `composite.py` can position by
real artwork bounds.

`composite.py` places artwork on the blank garment photographs. The print is
not pasted flat: the fabric's luminance under the print area is sampled and
used to modulate the ink, so folds and wrinkles read through it, and the
mask is softened slightly so nothing looks die-cut onto the photograph.

## Manufacturing files

`public/artwork/<slug>-front.png` and `-back.png` are the transferable
artwork: one flat colour, transparent ground, no gradients or halftones.
They are high-resolution PNGs, which a DTF printer takes directly.

For **vinyl cutting** the type must be converted to outlines first — a
cutter follows paths, not fonts. Any vector editor will do that from these
files, or from the layouts in `render.py`.

## What is not here yet

Front mockups. The six product photographs are back views, which is where
these designs live. Photographing the fronts needs blank front-view garments
to composite onto; the front artwork is rendered and committed, ready for
that pass.
