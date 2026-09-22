#!/usr/bin/env bash
set -euo pipefail

APP_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
SOURCE_ROOT=${KNITTING_EDITOR_WEB_SOURCE:-/Users/komorikouki/git/knittingEditor}
EXPECTED_COMMIT=8d3385799f61526334fd33c0a9e7be115f084afd

if [[ ! -d "$SOURCE_ROOT/src" ]]; then
  echo "Web source not found: $SOURCE_ROOT" >&2
  exit 1
fi

if [[ "$(git -C "$SOURCE_ROOT" rev-parse HEAD)" != "$EXPECTED_COMMIT" ]]; then
  echo "Web source commit changed; review the catalog and update the pinned SHA first." >&2
  exit 1
fi

if [[ -n "$(git -C "$SOURCE_ROOT" status --porcelain)" ]]; then
  echo "Web source is not clean; refusing to synchronize a dirty checkout." >&2
  exit 1
fi

mkdir -p "$APP_ROOT/Web/src" "$APP_ROOT/Web/public/guide"
rsync -a --delete "$SOURCE_ROOT/src/" "$APP_ROOT/Web/src/"
rsync -a "$SOURCE_ROOT/package.json" "$SOURCE_ROOT/package-lock.json" \
  "$SOURCE_ROOT/tsconfig.json" "$SOURCE_ROOT/tsconfig.app.json" \
  "$SOURCE_ROOT/tsconfig.node.json" "$SOURCE_ROOT/vite.config.ts" \
  "$APP_ROOT/Web/"

echo "Synchronized Web source at $EXPECTED_COMMIT"
