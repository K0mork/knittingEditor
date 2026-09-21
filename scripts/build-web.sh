#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WEB_ROOT="$APP_ROOT/Web"
OUTPUT_ROOT="$APP_ROOT/AppResources/Web"
STAMP_PATH="$APP_ROOT/AppResources/.web-build.stamp"

if [[ ! -f "$WEB_ROOT/package-lock.json" ]]; then
  echo "Web package metadata is missing; run scripts/sync-web-source.sh first." >&2
  exit 1
fi

if [[ ! -x "$WEB_ROOT/node_modules/.bin/vite" ]]; then
  (cd "$WEB_ROOT" && npm ci --ignore-scripts)
fi

input_hash="$(
  cd "$WEB_ROOT"
  LC_ALL=C find . -type f \
    ! -path './node_modules/*' \
    ! -path './dist/*' \
    ! -name '*.tsbuildinfo' \
    -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 shasum -a 256 \
    | shasum -a 256 \
    | awk '{print $1}'
)"

if [[ -f "$STAMP_PATH" && -f "$OUTPUT_ROOT/index.html" && "$(<"$STAMP_PATH")" == "$input_hash" ]]; then
  echo "Local Web assets are up to date; skipping Web build"
  exit 0
fi

(cd "$WEB_ROOT" && npm run build)

mkdir -p "$OUTPUT_ROOT"
find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 ! -name .gitkeep -exec rm -rf {} +
cp -R "$WEB_ROOT/dist/." "$OUTPUT_ROOT/"
printf '%s\n' "$input_hash" > "$STAMP_PATH"

echo "Built local Web assets into $OUTPUT_ROOT"
