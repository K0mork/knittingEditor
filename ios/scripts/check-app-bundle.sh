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
