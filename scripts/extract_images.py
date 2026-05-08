#!/usr/bin/env python3
"""Extract a single highest-resolution image URL per post from Tumblr API JSON dumps."""
import json
import re
from pathlib import Path

DATA = Path(__file__).parent.parent / "data"
SRCSET_RE = re.compile(r'(https://[^\s"]+)\s+(\d+)w')
IMG_SRC_RE = re.compile(r'<img[^>]+src="([^"]+)"')
DATA_ORIG_W_RE = re.compile(r'data-orig-width="(\d+)"')
DATA_ORIG_H_RE = re.compile(r'data-orig-height="(\d+)"')

posts_out = []
for offset in (0, 20, 40, 60):
    f = DATA / f"posts_{offset}.json"
    raw = json.loads(f.read_text())
    for p in raw["response"]["posts"]:
        post_id = p["id_string"]
        ts = p.get("timestamp", 0)
        date = p.get("date", "")
        url = p.get("post_url", "")
        body = p.get("body", "") or ""
        # Pull all candidate URLs from srcset entries (with width)
        candidates = SRCSET_RE.findall(body)
        # Also pick up src= as a fallback
        src = IMG_SRC_RE.search(body)
        orig_w = DATA_ORIG_W_RE.search(body)
        orig_h = DATA_ORIG_H_RE.search(body)
        if not candidates and not src:
            print(f"WARN: no image found in post {post_id}")
            continue
        # Choose the largest by srcset width
        if candidates:
            best_url, _ = max(candidates, key=lambda c: int(c[1]))
        else:
            best_url = src.group(1)
        # Tumblr serves higher resolutions via path manipulation: try s2048x3072
        # Convert any /s\d+x\d+(_c1)?/ or /s\d+x\d+_c1/ marker to /s2048x3072/
        upgraded = re.sub(r'/s\d+x\d+(?:_c1)?(?:u_c1)?/', '/s2048x3072/', best_url, count=1)
        posts_out.append({
            "id": post_id,
            "timestamp": ts,
            "date": date,
            "post_url": url,
            "image_url": upgraded,
            "image_url_fallback": best_url,
            "orig_width": int(orig_w.group(1)) if orig_w else None,
            "orig_height": int(orig_h.group(1)) if orig_h else None,
        })

# Sort newest first (highest timestamp) — that's the visual order on the blog
posts_out.sort(key=lambda x: x["timestamp"], reverse=True)
out_file = DATA / "photos.json"
out_file.write_text(json.dumps(posts_out, indent=2, ensure_ascii=False))
print(f"Wrote {len(posts_out)} entries to {out_file}")
for p in posts_out[:3]:
    print(p["id"], p["date"], p["orig_width"], "x", p["orig_height"])
