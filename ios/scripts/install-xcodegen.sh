#!/usr/bin/env bash
# XcodeGenのリリース版を取得し、版とSHA-256を確かめてから展開する。
#
#   ios/scripts/install-xcodegen.sh "$RUNNER_TEMP/xcodegen"
#
# CIでは`brew install xcodegen`がHomebrewの更新確認などで3分近くかかることがあり、
# macOSジョブ4つでそれぞれ待っていた。配布zipを直接使えば数秒で済み、版も固定できる。
# 版を上げるときは、リリースページに載るzipのSHA-256もあわせて書き換える。
#
# 展開先の`bin`を標準出力へ出す。GitHub Actionsでは`$GITHUB_PATH`にも追加する。
set -euo pipefail

version='2.46.0'
sha256='4d9e34b62172d645eed6457cac13fc222569974098ef4ee9c3368bedf0196806'
prefix="${1:?展開先のディレクトリを指定してください}"

archive="$(mktemp -d)/xcodegen.zip"
curl -fsSL --retry 3 -o "$archive" \
  "https://github.com/yonaskolb/XcodeGen/releases/download/$version/xcodegen.zip"
echo "$sha256  $archive" | shasum -a 256 -c - >&2

# zipの中は`xcodegen/bin/xcodegen`と`xcodegen/share/xcodegen/`。XcodeGenは
# 実行ファイルからの相対位置で`share`を探すので、この並びのまま置く。
mkdir -p "$prefix"
unzip -q -o "$archive" -d "$prefix"
bin="$prefix/xcodegen/bin"
"$bin/xcodegen" --version >&2

if [[ -n "${GITHUB_PATH:-}" ]]; then
  echo "$bin" >> "$GITHUB_PATH"
fi
echo "$bin"
