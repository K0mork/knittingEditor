#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WEB_ROOT="$APP_ROOT/Web"
OUTPUT_ROOT="$APP_ROOT/AppResources/Web"

if [[ ! -f "$WEB_ROOT/package-lock.json" ]]; then
  echo "Web package metadata is missing; run scripts/sync-web-source.sh first." >&2
  exit 1
fi

if [[ ! -x "$WEB_ROOT/node_modules/.bin/vite" ]]; then
  (cd "$WEB_ROOT" && npm ci --ignore-scripts)
fi

(cd "$WEB_ROOT" && npm run build)

mkdir -p "$OUTPUT_ROOT"
find "$OUTPUT_ROOT" -mindepth 1 -maxdepth 1 ! -name .gitkeep -exec rm -rf {} +
cp -R "$WEB_ROOT/dist/." "$OUTPUT_ROOT/"

echo "Built local Web assets into $OUTPUT_ROOT"
