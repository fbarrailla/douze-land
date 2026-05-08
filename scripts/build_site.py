#!/usr/bin/env python3
"""Generate index.html — a static shell whose plates are loaded from Supabase at runtime."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

html = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Douze Land — Thomas Douze</title>
<meta name="description" content="Douze Land — a photograph book by Thomas Douze.">
<meta property="og:title" content="Douze Land">
<meta property="og:description" content="A photograph book by Thomas Douze.">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y2PKR2R0RH"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
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
      <p class="cover__author">Thomas&nbsp;Douze</p>
      <div class="cover__meta">
        <span class="cover__meta-count">Photographs</span>
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
        frames between the rides &mdash; a child mid-flight on a scooter, a face caught
        laughing, the hours that don&rsquo;t make the postcard. Plates held to the light.
      </p>
      <p class="preface__sign">&mdash; T.&thinsp;D.</p>
    </div>
  </section>

  <main class="plates" id="plates" aria-busy="true">
    <p class="plates__loading">Loading photographs&hellip;</p>
  </main>

  <footer class="colophon">
    <div class="colophon__inner">
      <p class="colophon__mark">Douze Land</p>
      <p>
        Photographs and sequence by Thomas Douze.<br>
        Made in the spring of 2026.
      </p>
      <p class="colophon__credit">
        Set in <em>Oswald</em> and <em>Cormorant Garamond</em>.<br>
        Originally published as a notebook at
        <a href="https://douzeland.tumblr.com" rel="noopener">douzeland.tumblr.com</a>.
      </p>
      <p class="colophon__copy">&copy; Thomas Douze, MMXXVI</p>
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

  <script type="module" src="script.js"></script>
</body>
</html>
"""

(ROOT / "index.html").write_text(html)
print("Wrote index.html (dynamic plates)")
