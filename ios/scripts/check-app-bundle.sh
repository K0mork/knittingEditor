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

external_matches=$(find "$WEB_ROOT" -type f ! -name '*.map' -exec grep -nE 'googletagmanager|G-VVE0G4ZFL4|knittingeditor\.com' {} + || true)
if [ -n "$external_matches" ]; then
  echo "unexpected external runtime reference in app bundle" >&2
  printf '%s\n' "$external_matches" >&2
  exit 1
fi

network_matches=$(find "$WEB_ROOT" -type f ! -name '*.map' -exec grep -nE '(^|[^[:alnum:]_])(fetch|XMLHttpRequest|WebSocket|EventSource)[[:space:]]*\(' {} + || true)
if [ -n "$network_matches" ]; then
  echo "unexpected network API in app bundle" >&2
  printf '%s\n' "$network_matches" >&2
  exit 1
fi

echo "app bundle assets and offline references are valid"
