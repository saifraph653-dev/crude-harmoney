# Renders the collection's artwork as precise typography.
#
# Previously the graphics were whatever an image model produced from a
# description. They are now laid out here, in CSS, and rendered by a browser
# with the brand's own typeface -- so the letterforms, spacing and
# composition are decided rather than approximated.
from playwright.sync_api import sync_playwright
import pathlib, json

CREAM = "#ECE7DD"
INK = "#14130F"

FONT = ("https://fonts.googleapis.com/css2?"
        "family=Archivo:wght@400;500;600;700;800;900&display=swap")

# Only true statements about the brand appear in the artwork: the name, the
# city, the volume, and how the pieces are made. No invented run counts, no
# slogans, no Latin, no dates.
BACKS = {
"shirt-01": ("""
<div class="stack">
  <div class="lockup">CRUDE<br>HARMONY</div>
  <div class="rule"></div>
  <div class="meta">DOHA &nbsp;·&nbsp; QATAR</div>
</div>""", CREAM, """
.lockup{font-weight:800;font-size:150px;line-height:.84;letter-spacing:-.045em;text-align:center}
.rule{height:3px;background:currentColor;margin:30px auto 0;width:100%}
.meta{margin-top:16px;font-size:20px;letter-spacing:.42em;font-weight:600;text-align:center}
"""),

"shirt-02": ("""
<div class="stack">
  <div class="vol">VOL.</div>
  <div class="num">01</div>
  <div class="meta">CUT AND PRESSED ONE PIECE AT A TIME</div>
</div>""", INK, """
.vol{font-size:30px;letter-spacing:.4em;font-weight:700;text-align:center;margin-bottom:6px}
.num{font-weight:900;font-size:290px;line-height:.78;letter-spacing:-.06em;text-align:center}
.meta{margin-top:26px;font-size:17px;letter-spacing:.3em;font-weight:600;text-align:center}
"""),

"shirt-03": ("""
<div class="stack">
  <div class="rule"></div>
  <p class="block">HEAVYWEIGHT BLANKS. CUT AND PRESSED ONE PIECE AT A TIME. EACH RUN IS A FIXED NUMBER. WHEN A SIZE IS GONE IT IS GONE. WE DO NOT REPRINT.</p>
  <div class="rule"></div>
  <div class="meta">CRUDE HARMONY &nbsp;·&nbsp; DOHA</div>
</div>""", INK, """
.rule{height:2px;background:currentColor;width:100%}
.block{font-size:42px;line-height:1.34;letter-spacing:.02em;font-weight:600;text-align:justify;margin:22px 0}
.meta{margin-top:14px;font-size:18px;letter-spacing:.36em;font-weight:600;text-align:center}
"""),

"hoodie-01": ("""
<div class="spine"><span>CRUDE HARMONY</span></div>""", CREAM, """
.spine{display:flex;align-items:center;justify-content:center;width:100%;height:1240px}
.spine span{font-size:62px;font-weight:700;letter-spacing:.42em;white-space:nowrap;
            transform:rotate(90deg);transform-origin:center}
"""),

"hoodie-02": ("""
<div class="stack">
  <div class="top">CRUDE HARMONY</div>
  <div class="bar"></div>
  <div class="meta">DOHA &nbsp;—&nbsp; VOL. 01</div>
</div>""", CREAM, """
.top{font-size:56px;font-weight:700;letter-spacing:.26em;text-align:center}
.bar{height:26px;background:currentColor;margin:22px 0;width:100%}
.meta{font-size:22px;letter-spacing:.4em;font-weight:600;text-align:center}
"""),

"hoodie-03": ("""
<div class="stack">
  <div class="small">CRUDE</div>
  <div class="word">HARMONY</div>
</div>""", INK, """
.small{font-size:26px;letter-spacing:.5em;font-weight:700;text-align:right;margin-bottom:10px;padding-right:2.2em}
.word{font-size:118px;font-weight:800;letter-spacing:.06em;text-align:center;line-height:1}
"""),
}

FRONTS = {
"shirt-01": ("CRUDE HARMONY", CREAM, 26, ".34em"),
"shirt-02": ("01", INK, 46, ".05em"),
"shirt-03": ("CH", INK, 40, ".18em"),
"hoodie-01": ("CRUDE HARMONY", CREAM, 24, ".34em"),
"hoodie-02": ("DOHA", CREAM, 28, ".38em"),
"hoodie-03": ("CH", INK, 38, ".18em"),
}

SHELL = """<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{font}" rel="stylesheet">
<style>
  html,body{{margin:0;background:transparent}}
  body{{font-family:Archivo,sans-serif;color:{color};display:flex;
        align-items:center;justify-content:center;width:{w}px;min-height:{h}px}}
  .stack{{width:100%}}
  {css}
</style></head><body>{html}</body></html>"""

out = pathlib.Path("/tmp/art"); out.mkdir(exist_ok=True)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium")
    for slug,(html,color,css) in BACKS.items():
        w,h = (620, 1300) if slug=="hoodie-01" else (900, 620)
        pg = b.new_page(viewport={"width":w,"height":h}, device_scale_factor=2)
        pg.set_content(SHELL.format(font=FONT,color=color,css=css,html=html,w=w,h=h))
        pg.wait_for_timeout(1400)
        pg.screenshot(path=str(out/f"back-{slug}.png"), omit_background=True)
        pg.close()
    for slug,(text,color,size,track) in FRONTS.items():
        pg = b.new_page(viewport={"width":700,"height":160}, device_scale_factor=3)
        pg.set_content(SHELL.format(font=FONT,color=color,w=700,h=160,
            css=f".m{{font-size:{size}px;font-weight:700;letter-spacing:{track}}}",
            html=f'<div class="m">{text}</div>'))
        pg.wait_for_timeout(1200)
        pg.screenshot(path=str(out/f"front-{slug}.png"), omit_background=True)
        pg.close()
    b.close()

# Trim each file to its ink, so compositing can position by real artwork
# bounds rather than by whatever canvas it happened to be drawn on.
from PIL import Image
for f in sorted(out.glob("*.png")):
    im = Image.open(f).convert("RGBA")
    bbox = im.getchannel("A").getbbox()
    if bbox:
        im.crop(bbox).save(f)

print("rendered", len(BACKS), "backs and", len(FRONTS), "fronts")
