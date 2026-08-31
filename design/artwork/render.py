# Renders the collection's artwork as precise typography.
#
# The layouts live here, in CSS and SVG, set in the brand's typeface and
# rendered by a browser. The image model never designs a graphic; it only
# photographs blank garments.
#
# Vocabulary: an arched wordmark and a tight CH monogram. Both are the
# ordinary devices of clothing people actually wear, which is the point --
# an earlier pass was justified text blocks and stepped bars, which read as
# a design exercise rather than a shirt someone would pick up.
from playwright.sync_api import sync_playwright
import pathlib

CREAM = "#EDE8DE"
INK = "#16150F"

FONT = ("https://fonts.googleapis.com/css2?"
        "family=Archivo:wght@400;500;600;700;800;900&display=swap")


def arch(text, sub, color, size=112, weight=800, width=1400, sweep=210, track=2):
    """Wordmark on an arc. Curved type is the most recognisable device in
    everyday streetwear and the one thing this brand did not have."""
    sub_markup = (f'<text x="700" y="{sweep + 176}" text-anchor="middle" '
                  f'font-size="34" font-weight="700" letter-spacing="14" '
                  f'fill="{color}">{sub}</text>') if sub else ""
    return f'''
<svg viewBox="0 0 1400 {sweep + 230}" width="{width}" xmlns="http://www.w3.org/2000/svg">
  <defs><path id="a" d="M 110 {sweep + 40} A 620 {sweep - 10} 0 0 1 1290 {sweep + 40}"/></defs>
  <text font-family="Archivo" font-size="{size}" font-weight="{weight}"
        letter-spacing="{track}" fill="{color}">
    <textPath href="#a" startOffset="50%" text-anchor="middle">{text}</textPath>
  </text>
  {sub_markup}
</svg>'''


def monogram(color, size=300):
    """CH set tight enough that the letters meet. Drawn from the brand's own
    typeface rather than invented, so the mark and the wordmark are the same
    voice."""
    return (f'<div style="font-size:{size}px;font-weight:900;letter-spacing:-.09em;'
            f'color:{color};line-height:.82">CH</div>')


BACKS = {
    # Men's tee 01 -- the signature arc.
    "arc-tee": arch("CRUDE HARMONY", "DOHA", CREAM),
    # Men's tee 02 -- the mark, large and alone.
    "monogram-tee": (f'<div style="text-align:center">{monogram(INK, 360)}'
                     f'<div style="font-size:30px;font-weight:700;letter-spacing:.42em;'
                     f'color:{INK};margin-top:26px">DOHA &nbsp;·&nbsp; QATAR</div></div>'),
    # Men's hoodie 01 -- both devices together, arc over mark. A straight rule
    # under a curved baseline read as a floating bar, and arc-plus-subtext was
    # too close to the tee to count as a second design.
    "arc-hoodie": ('<div style="text-align:center">'
                   + arch("CRUDE HARMONY", "", CREAM, size=104, width=1300)
                   + f'<div style="margin-top:-140px">{monogram(CREAM, 210)}</div></div>'),
    # Men's hoodie 02 -- quieter, set flush left instead of centred.
    "stack-hoodie": (f'<div style="text-align:left">'
                     f'<div style="font-size:132px;font-weight:800;line-height:.86;'
                     f'letter-spacing:-.04em;color:{CREAM}">CRUDE<br>HARMONY</div>'
                     f'<div style="font-size:28px;font-weight:700;letter-spacing:.4em;'
                     f'color:{CREAM};margin-top:22px">DOHA — QATAR</div></div>'),
    # Women's tee -- its own treatment: a small rule-set wordmark, placed high,
    # not the men's arc shrunk down.
    "line-tee": (f'<div style="text-align:center">'
                 f'<div style="height:2px;background:{INK};width:100%"></div>'
                 f'<div style="font-size:58px;font-weight:700;letter-spacing:.3em;'
                 f'color:{INK};margin:22px 0">CRUDE HARMONY</div>'
                 f'<div style="height:2px;background:{INK};width:100%"></div></div>'),
    # Women's hoodie -- the mark on its own, smaller and higher.
    "monogram-hoodie": (f'<div style="text-align:center">{monogram(INK, 250)}</div>'),
}

FRONTS = {
    "arc-tee":         ('<div class="m" style="font-size:74px;font-weight:900;letter-spacing:-.09em">CH</div>', CREAM),
    "monogram-tee":    ('<div class="m" style="font-size:26px;font-weight:700;letter-spacing:.34em">CRUDE HARMONY</div>', INK),
    "arc-hoodie":      ('<div class="m" style="font-size:70px;font-weight:900;letter-spacing:-.09em">CH</div>', CREAM),
    "stack-hoodie":    ('<div class="m" style="font-size:24px;font-weight:700;letter-spacing:.34em">CRUDE HARMONY</div>', CREAM),
    "line-tee":        ('<div class="m" style="font-size:58px;font-weight:900;letter-spacing:-.09em">CH</div>', INK),
    "monogram-hoodie": ('<div class="m" style="font-size:22px;font-weight:700;letter-spacing:.34em">CRUDE HARMONY</div>', INK),
}

SHELL = """<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{font}" rel="stylesheet">
<style>
  html,body{{margin:0;background:transparent}}
  body{{font-family:Archivo,sans-serif;display:flex;align-items:center;
        justify-content:center;width:{w}px;min-height:{h}px;padding:40px;
        box-sizing:border-box}}
  svg text{{font-family:Archivo,sans-serif}}
</style></head><body><div style="width:100%">{html}</div></body></html>"""

out = pathlib.Path("/tmp/art"); out.mkdir(exist_ok=True)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    for slug, html in BACKS.items():
        pg = b.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=2)
        pg.set_content(SHELL.format(font=FONT, html=html, w=1600, h=900))
        pg.wait_for_timeout(1600)
        pg.screenshot(path=str(out / f"back-{slug}.png"), omit_background=True)
        pg.close()
    for slug, (html, color) in FRONTS.items():
        pg = b.new_page(viewport={"width": 900, "height": 240}, device_scale_factor=3)
        pg.set_content(SHELL.format(font=FONT, html=f'<div style="color:{color};text-align:center">{html}</div>', w=900, h=240))
        pg.wait_for_timeout(1400)
        pg.screenshot(path=str(out / f"front-{slug}.png"), omit_background=True)
        pg.close()
    b.close()

# Trim to the ink so compositing positions by real artwork bounds.
from PIL import Image
for f in sorted(out.glob("*.png")):
    im = Image.open(f).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im.crop(bbox).save(f)
print("rendered", len(BACKS), "backs,", len(FRONTS), "fronts")
