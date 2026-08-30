# Places the collection's artwork onto the blank garments.
#
# The print is not pasted flat. The fabric's own luminance under the print
# area is sampled and used to modulate the ink, so wrinkles and folds read
# through it the way a real heat transfer behaves, and the edges are softened
# by a fraction of a pixel so nothing looks die-cut onto the photograph.
from PIL import Image, ImageFilter, ImageStat
import pathlib

OUT = pathlib.Path("/tmp/mockups")  # scratch; the shipped files live in public/products; OUT.mkdir(exist_ok=True)

# width as a fraction of the frame, and the top edge as a fraction of height
PLACEMENT = {
    "shirt-01":  dict(w=0.46, top=0.34),
    "shirt-02":  dict(w=0.30, top=0.32),
    "shirt-03":  dict(w=0.46, top=0.36),
    "hoodie-01": dict(w=0.030, top=0.34),   # vertical spine
    "hoodie-02": dict(w=0.44, top=0.44),
    "hoodie-03": dict(w=0.46, top=0.46),
}

for slug, place in PLACEMENT.items():
    garment = Image.open(f"/tmp/blanks/{slug}.png").convert("RGB")
    art = Image.open(f"/tmp/art/back-{slug}.png").convert("RGBA")

    GW, GH = garment.size
    target_w = int(GW * place["w"])
    scale = target_w / art.width
    art = art.resize((target_w, max(1, int(art.height * scale))), Image.LANCZOS)

    x = (GW - art.width) // 2
    y = int(GH * place["top"])

    # Fabric luminance under the print, normalised around its own mean. This
    # is what carries the wrinkles into the ink.
    region = garment.crop((x, y, x + art.width, y + art.height)).convert("L")
    mean = ImageStat.Stat(region).mean[0] or 1
    shade = region.point(lambda v, m=mean: max(0, min(255, int(128 + (v - m) * 0.55))))
    shade = shade.filter(ImageFilter.GaussianBlur(1.2))

    ink = Image.new("RGB", art.size, (0, 0, 0))
    ink.paste(art.convert("RGB"), (0, 0))

    # Modulate: 128 in `shade` is neutral, lighter lifts the ink, darker sinks
    # it, so the print follows the cloth instead of sitting on a flat plane.
    px_ink, px_shade = ink.load(), shade.load()
    for iy in range(art.height):
        for ix in range(art.width):
            f = (px_shade[ix, iy] - 128) / 255.0
            r, g, bl = px_ink[ix, iy]
            px_ink[ix, iy] = (
                max(0, min(255, int(r + r * f * 0.9 + f * 42))),
                max(0, min(255, int(g + g * f * 0.9 + f * 42))),
                max(0, min(255, int(bl + bl * f * 0.9 + f * 42))),
            )

    # Soften the mask a touch: a perfectly hard edge reads as a paste-up.
    mask = art.getchannel("A").filter(ImageFilter.GaussianBlur(0.6))
    garment.paste(ink, (x, y), mask)
    garment.save(OUT / f"{slug}.png")
    print(f"{slug:11} art {art.width}x{art.height} at ({x},{y}) on {GW}x{GH}")
