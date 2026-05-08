#!/usr/bin/env bash
set -euo pipefail
API_KEY="fuiKNFp9vQFvjLNvx4sUwti4Yb5yGutBN4Xh10LXZhhRKjWlV4"
BASE="https://api.tumblr.com/v2/blog/douzeland.tumblr.com/posts"
OUT_DIR="$(cd "$(dirname "$0")"/../data && pwd)"

for offset in 0 20 40 60; do
  echo "Fetching offset=$offset"
  curl -s "$BASE?api_key=$API_KEY&limit=20&offset=$offset&reblog_info=false&notes_info=false" \
    -o "$OUT_DIR/posts_$offset.json"
done

echo "Done."
ls -la "$OUT_DIR"
