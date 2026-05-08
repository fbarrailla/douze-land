#!/usr/bin/env bash
# Download every photo (highest available resolution) to public/images/<id>.jpg.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")"/.. && pwd)"
OUT="$ROOT/public/images"
mkdir -p "$OUT"

python3 - <<'PY'
import json, subprocess, sys, time, os
from pathlib import Path
root = Path(__file__).resolve().parent.parent if "__file__" in dir() else Path(".")
PY

# Use python directly to drive curl, with retry on smaller-size fallback if 2048 not available.
python3 - "$OUT" <<'PY'
import json, subprocess, sys, time, os, urllib.request
from pathlib import Path

out_dir = Path(sys.argv[1])
data = json.load(open(Path(out_dir).parent.parent / "data" / "photos.json"))
ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Referer": "https://douzeland.tumblr.com/"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
    dest.write_bytes(body)
    return len(body)

ok = 0
for i, p in enumerate(data, 1):
    dest = out_dir / f"{p['id']}.jpg"
    if dest.exists() and dest.stat().st_size > 50_000:
        ok += 1
        continue
    try:
        size = fetch(p["image_url"], dest)
    except Exception as e:
        print(f"  [{i}/{len(data)}] {p['id']} hi-res failed ({e}), trying fallback")
        try:
            size = fetch(p["image_url_fallback"], dest)
        except Exception as e2:
            print(f"  [{i}/{len(data)}] {p['id']} FAILED: {e2}")
            continue
    print(f"  [{i}/{len(data)}] {p['id']}: {size//1024} KB")
    ok += 1

print(f"Saved {ok}/{len(data)} photos to {out_dir}")
PY
