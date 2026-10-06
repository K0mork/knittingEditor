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

# 理由の申告が必要なAPI（required reason API）を使うときは、Privacy Manifestに種類と理由が要る。
# 無いとApp Store Connectへのアップロードが ITMS-91053 で拒否されるが、署名もアップロードもしない
# CIでは気づけない。そこで、実行ファイルが取り込むシンボルと呼ぶセレクタから使っている種類を調べ、
# 理由つきで申告されていることを確かめる。
declared_api_types=$(plutil -convert json -o - "$APP_PATH/PrivacyInfo.xcprivacy" | jq -r '
  (.NSPrivacyAccessedAPITypes // [])[]
  | select((.NSPrivacyAccessedAPITypeReasons // []) | length > 0)
  | .NSPrivacyAccessedAPIType
')
executable_name=$(plutil -extract CFBundleExecutable raw -o - "$APP_PATH/Info.plist")
imported_symbols=$(mktemp)
binary_strings=$(mktemp)
trap 'rm -f "$imported_symbols" "$binary_strings"' EXIT
# Debugビルドでは本体のコードが`<名前>.debug.dylib`に入るため、同じ階層のdylibも調べる。
find "$APP_PATH" -maxdepth 1 -type f \( -name "$executable_name" -o -name '*.dylib' \) | while IFS= read -r binary; do
  nm -u "$binary" 2>/dev/null >>"$imported_symbols"
  strings -a "$binary" >>"$binary_strings"
done
if [ ! -s "$imported_symbols" ]; then
  echo "could not read imported symbols of the app executable" >&2
  exit 1
fi

require_api_declaration() {
  category="$1"
  symbol_pattern="$2"
  selector_pattern="$3"
  used=false
  if [ -n "$symbol_pattern" ] && grep -Eq "$symbol_pattern" "$imported_symbols"; then
    used=true
  fi
  if [ -n "$selector_pattern" ] && grep -Eqx "$selector_pattern" "$binary_strings"; then
    used=true
  fi
  if [ "$used" = true ] && ! printf '%s\n' "$declared_api_types" | grep -qx "$category"; then
    echo "Privacy Manifest does not declare a reason for required reason API: $category" >&2
    exit 1
  fi
}

require_api_declaration NSPrivacyAccessedAPICategoryUserDefaults 'UserDefaults' ''
require_api_declaration NSPrivacyAccessedAPICategoryFileTimestamp \
  '^_(f|l)?stat(at)?(\$INODE64)?$|^_f?getattrlist|NSFileCreationDate|NSFileModificationDate|NSURL(Content)?(Creation|Modification)DateKey|creationDate|ModificationDate' ''
require_api_declaration NSPrivacyAccessedAPICategorySystemBootTime '^_mach_absolute_time$' 'systemUptime'
require_api_declaration NSPrivacyAccessedAPICategoryDiskSpace \
  '^_f?statv?fs|NSFileSystem(Free)?Size|NSURLVolume(Available|Total)Capacity|volume(Available|Total)Capacity' ''
require_api_declaration NSPrivacyAccessedAPICategoryActiveKeyboards '' 'activeInputModes'

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
