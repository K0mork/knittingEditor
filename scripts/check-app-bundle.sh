#!/bin/sh
set -eu

APP_PATH="${1:-}"
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "usage: $0 /path/to/knittingEditor.app" >&2
  exit 2
fi

WEB_ROOT="$APP_PATH/Web"
for required in index.html assets guide/index.html; do
  if [ ! -e "$WEB_ROOT/$required" ]; then
    echo "missing bundled asset: $required" >&2
    exit 1
  fi
done

if [ ! -f "$APP_PATH/PrivacyInfo.xcprivacy" ]; then
  echo "missing Privacy Manifest" >&2
  exit 1
fi
plutil -lint "$APP_PATH/PrivacyInfo.xcprivacy" >/dev/null

if rg -n --hidden --glob '!*.map' 'googletagmanager|G-VVE0G4ZFL4|knittingeditor\.com' "$WEB_ROOT"; then
  echo "unexpected external runtime reference in app bundle" >&2
  exit 1
fi

echo "app bundle assets and offline references are valid"
