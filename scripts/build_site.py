#!/usr/bin/env python3
"""Generate index.html from data/photos.json — a static, prerendered photograph book."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = json.load(open(ROOT / "data" / "photos.json"))

def roman(n: int) -> str:
    vals = [(1000,"M"),(900,"CM"),(500,"D"),(400,"CD"),(100,"C"),(90,"XC"),
            (50,"L"),(40,"XL"),(10,"X"),(9,"IX"),(5,"V"),(4,"IV"),(1,"I")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s; n -= v
    return out

# Layout rhythm:
#   Every 6th plate is full-bleed for breathing room.
#   Every 3rd plate gets an off-center inset (slightly narrower) for variety.
def variant(idx: int, w: int | None, h: int | None) -> str:
    if w and h and h > w:
        return "tall"  # portrait — give it its own treatment
    if (idx + 1) % 6 == 0:
        return "wide"
    if (idx + 1) % 3 == 0:
        return "inset"
    return "default"

plates_html = []
for i, p in enumerate(PHOTOS):
    n = i + 1
    v = variant(i, p.get("orig_width"), p.get("orig_height"))
    img_path = f"images/{p['id']}.jpg"
    w = p.get("orig_width") or 2048
    h = p.get("orig_height") or 1365
    plates_html.append(f"""        <figure class="plate plate--{v}" data-plate="{n}" data-id="{p['id']}">
          <div class="plate__frame">
            <img src="{img_path}" alt="Douze Land, plate {roman(n)}" loading="lazy" decoding="async" width="{w}" height="{h}">
          </div>
          <figcaption class="plate__caption">
            <span class="plate__num">{roman(n)}</span>
            <span class="plate__rule" aria-hidden="true"></span>
            <span class="plate__title">Douze Land</span>
          </figcaption>
        </figure>""")
plates_block = "\n".join(plates_html)

# Embed photos as JSON for the lightbox script
photos_for_js = [
    {"id": p["id"], "src": f"images/{p['id']}.jpg", "n": i + 1, "roman": roman(i + 1)}
    for i, p in enumerate(PHOTOS)
]

html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Douze Land — Thomas Fleurie</title>
<meta name="description" content="Douze Land — a photograph book by Thomas Fleurie. Seventy-four plates.">
<meta property="og:title" content="Douze Land">
<meta property="og:description" content="A photograph book by Thomas Fleurie.">
<meta property="og:image" content="images/{PHOTOS[0]['id']}.jpg">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y2PKR2R0RH"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', 'G-Y2PKR2R0RH');
</script>
</head>
<body>
  <a class="skip" href="#plates">Skip to photographs</a>

  <header class="cover" role="banner">
    <div class="cover__inner">
      <p class="cover__kicker">A photograph book</p>
      <h1 class="cover__title">
        <span class="cover__title-line">Douze</span>
        <span class="cover__title-line">Land</span>
      </h1>
      <p class="cover__author">Thomas&nbsp;Fleurie</p>
      <div class="cover__meta">
        <span>Seventy-four photographs</span>
        <span class="cover__meta-dot" aria-hidden="true">·</span>
        <span>MMXXVI</span>
      </div>
    </div>
    <a class="cover__scroll" href="#preface" aria-label="Begin">
      <span>Open the book</span>
      <span class="cover__arrow" aria-hidden="true"></span>
    </a>
  </header>

  <section class="preface" id="preface">
    <div class="preface__inner">
      <p class="preface__lede">Twelve days inside a kingdom that wasn&rsquo;t built to be looked at this way.</p>
      <p>
        <em>Douze Land</em> is a wandering through turrets and tarmac, the small
        frames between the rides — a child mid-flight on a scooter, a face caught
        laughing, the hours that don&rsquo;t make the postcard. Seventy-four plates,
        held to the light.
      </p>
      <p class="preface__sign">— T.&thinsp;F.</p>
    </div>
  </section>

  <main class="plates" id="plates">
{plates_block}
  </main>

  <footer class="colophon">
    <div class="colophon__inner">
      <p class="colophon__mark">Douze Land</p>
      <p>
        Photographs and sequence by Thomas Fleurie.<br>
        Seventy-four plates, made in the spring of 2026.
      </p>
      <p class="colophon__credit">
        Set in <em>Oswald</em> and <em>Cormorant Garamond</em>.<br>
        Originally published as a notebook at
        <a href="https://douzeland.tumblr.com" rel="noopener">douzeland.tumblr.com</a>.
      </p>
      <p class="colophon__copy">© Thomas Fleurie, MMXXVI</p>
    </div>
  </footer>

  <div class="lightbox" id="lightbox" hidden aria-hidden="true" role="dialog" aria-label="Photograph viewer">
    <button class="lightbox__close" aria-label="Close">&times;</button>
    <button class="lightbox__nav lightbox__nav--prev" aria-label="Previous photograph">&larr;</button>
    <figure class="lightbox__figure">
      <img class="lightbox__img" alt="">
      <figcaption class="lightbox__caption"></figcaption>
    </figure>
    <button class="lightbox__nav lightbox__nav--next" aria-label="Next photograph">&rarr;</button>
  </div>

  <script>
    window.__DOUZE = {json.dumps(photos_for_js, ensure_ascii=False)};
  </script>
  <script src="script.js" defer></script>
</body>
</html>
"""

(ROOT / "index.html").write_text(html)
print(f"Wrote index.html with {len(PHOTOS)} plates")
