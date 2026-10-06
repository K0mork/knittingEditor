#!/bin/sh
set -eu

APP_PATH="${1:-}"
if [ -z "$APP_PATH" ] || [ ! -d "$APP_PATH" ]; then
  echo "usage: $0 /path/to/knittingEditor.app" >&2
  exit 2
fi

WEB_ROOT="$APP_PATH/Web"
for required in index.html assets guide/index.html third-party-notices/index.html; do
  if [ ! -e "$WEB_ROOT/$required" ]; then
    echo "missing bundled asset: $required" >&2
    exit 1
  fi
done

for package in fflate idb react react-dom scheduler; do
  if ! grep -q "<h2>$package " "$WEB_ROOT/third-party-notices/index.html"; then
    echo "missing third-party license notice: $package" >&2
    exit 1
  fi
done

# ソースマップはアプリで使わないので同梱しない（`ios/Web/vite.config.ts`）。
source_maps=$(find "$WEB_ROOT" -type f -name '*.map')
if [ -n "$source_maps" ]; then
  echo "unexpected source maps in app bundle" >&2
  printf '%s\n' "$source_maps" >&2
  exit 1
fi

if [ ! -f "$APP_PATH/PrivacyInfo.xcprivacy" ]; then
  echo "missing Privacy Manifest" >&2
  exit 1
fi
plutil -lint "$APP_PATH/PrivacyInfo.xcprivacy" >/dev/null

# 「使い方」のサポートページとサポートのメールアドレスは、利用者が選んだときだけSafariとメールアプリで開くリンクなので除く。
external_matches=$(find "$WEB_ROOT" -type f -exec perl -ne '
  s{https://knittingeditor\.com/support/|support\@knittingeditor\.com}{}g;
  print "$ARGV:$.:$_" if /googletagmanager|G-VVE0G4ZFL4|knittingeditor\.com/;
  close ARGV if eof;
' {} + || true)
if [ -n "$external_matches" ]; then
  echo "unexpected external runtime reference in app bundle" >&2
  printf '%s\n' "$external_matches" >&2
  exit 1
fi

network_matches=$(find "$WEB_ROOT" -type f -exec grep -nE '(^|[^[:alnum:]_])(fetch|XMLHttpRequest|WebSocket|EventSource)[[:space:]]*\(' {} + || true)
if [ -n "$network_matches" ]; then
  echo "unexpected network API in app bundle" >&2
  printf '%s\n' "$network_matches" >&2
  exit 1
fi

echo "app bundle assets and offline references are valid"
