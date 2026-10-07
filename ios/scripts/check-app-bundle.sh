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

# `.knit`の種類名（Filesの「情報を見る」や共有シートに出る）。識別子を変えると既存の`.knit`の
# 関連付けが切れるので固定する。名前は`App/InfoPlist.xcstrings`で日本語と英語を持つ。
INFO_PLIST="$APP_PATH/Info.plist"
knit_type_id='com.k0mork.knitting-editor.knit'
knit_type_name='棒針編み図バックアップ'
# `plutil -extract`はキーパスを`.`で区切る（`UTExportedTypeDeclarations.0.UTTypeIdentifier`）。
# そのため、`.`を含むキーそのものは引けない（失敗して空になる）。
plist_value() {
  plutil -extract "$1" raw -o - "${2:-$INFO_PLIST}" 2>/dev/null || true
}
[ "$(plist_value UTExportedTypeDeclarations.0.UTTypeIdentifier)" = "$knit_type_id" ] \
  && [ "$(plist_value CFBundleDocumentTypes.0.LSItemContentTypes.0)" = "$knit_type_id" ] || {
  echo "unexpected .knit type identifier" >&2
  exit 1
}
# InfoPlist.stringsでは、Info.plistの値そのものが訳のキーになる。
for key in UTExportedTypeDeclarations.0.UTTypeDescription CFBundleDocumentTypes.0.CFBundleTypeName; do
  [ "$(plist_value "$key")" = "$knit_type_name" ] || {
    echo "unexpected .knit type name in Info.plist ($key): $(plist_value "$key")" >&2
    exit 1
  }
done
check_knit_type_name() {
  strings_path="$APP_PATH/$1.lproj/InfoPlist.strings"
  [ -f "$strings_path" ] || {
    echo "missing localized Info.plist strings: $1.lproj" >&2
    exit 1
  }
  # 訳のキー（種類名）には`.`が無いので、`plutil -extract`でそのまま引ける。
  actual=$(plist_value "$knit_type_name" "$strings_path")
  [ "$actual" = "$2" ] || {
    echo "unexpected .knit type name in $1.lproj: ${actual:-<missing>}" >&2
    exit 1
  }
}
check_knit_type_name ja "$knit_type_name"
check_knit_type_name en 'Knitting Chart Backup'

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
