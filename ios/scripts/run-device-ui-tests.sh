#!/bin/sh
# 版の提出前に、実機でUIテストの一覧を流す（ios/docs/DEVICE_TESTING.mdの①）。
#
#   KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX ios/scripts/run-device-ui-tests.sh <UDID> [output directory]
#
# 1. 端末のアプリとテスト用のアプリを削除し、空のデータから始める。
# 2. 今のコミットの開発ビルドを入れ、ios/UITests/device-ui-tests.txtのテストを流す。
# 3. もう一度削除してアプリだけを入れ直し、テストが作った編み図を消す。
# 4. 結果（xcresult）、画面写真、端末の機種とOSの版を出力先に残す。
#
# 検証用の端末で使う。端末内のこのアプリの編み図はすべて消える。
# 端末はケーブルでつなぎ、ロックを解除し、「設定 > デベロッパ > UIオートメーション」をオンにしておく。
set -eu

if [ $# -lt 1 ]; then
  echo "usage: KNITTING_EDITOR_DEVELOPMENT_TEAM=<TeamID> $0 <device UDID> [output directory]" >&2
  exit 2
fi
DEVICE=$1
TEAM=${KNITTING_EDITOR_DEVELOPMENT_TEAM:-}
if [ -z "$TEAM" ]; then
  echo 'ERROR: set KNITTING_EDITOR_DEVELOPMENT_TEAM to the 10-character Apple Team ID.' >&2
  exit 2
fi
for command in xcodebuild xcrun jq; do
  command -v "$command" >/dev/null 2>&1 || { echo "ERROR: $command is required." >&2; exit 2; }
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT="$SCRIPT_DIR/../knittingEditor.xcodeproj"
LIST="$SCRIPT_DIR/../UITests/device-ui-tests.txt"
APP_ID=com.k0mork.knittingEditor
RUNNER_ID=com.k0mork.knittingEditor.uitests.xctrunner
OUT=${2:-$(mktemp -d "${TMPDIR:-/tmp}/knitting-device-ui-tests.XXXXXX")}
# 2台目は1台目のビルドの続きから作れるよう、出力先とは別に置く。
DERIVED=${KNITTING_EDITOR_DEVICE_DERIVED_DATA:-${TMPDIR:-/tmp}/knitting-device-ui-tests-DerivedData}
RESULT="$OUT/device-ui-tests.xcresult"
mkdir -p "$OUT"
rm -rf "$RESULT" "$OUT/attachments"

# 機種とOSの版を記録し、ケーブルでつながっていることを確かめる。Wi-Fiのペアリングは
# テストの途中で切れることがあり、問い合わせへの応答だけでは有線かどうか分からない
# （REAL_DEVICE_RELEASE_CHECKLIST.mdの「接続状態の見方」）。
devices_json="$OUT/devices.json"
xcrun devicectl list devices --json-output "$devices_json" >/dev/null 2>&1 \
  || { echo 'ERROR: devicectl could not list devices.' >&2; exit 1; }
device=$(jq -r --arg udid "$DEVICE" '
  .result.devices[] | select(.hardwareProperties.udid == $udid)
  | [(.hardwareProperties.marketingName // "?"), (.hardwareProperties.productType // "?"),
     (.deviceProperties.osVersionNumber // "?"), (.connectionProperties.transportType // "none"),
     (.deviceProperties.developerModeStatus // "?")] | @tsv' "$devices_json")
rm -f "$devices_json"
if [ -z "$device" ]; then
  echo "ERROR: device $DEVICE is not paired with this Mac." >&2
  exit 1
fi
model=$(printf '%s' "$device" | cut -f1)
product=$(printf '%s' "$device" | cut -f2)
os=$(printf '%s' "$device" | cut -f3)
transport=$(printf '%s' "$device" | cut -f4)
developer_mode=$(printf '%s' "$device" | cut -f5)
printf '機種: %s (%s)\nOS: %s\n' "$model" "$product" "$os" | tee "$OUT/device.txt"
if [ "$transport" != wired ] || [ "$developer_mode" != enabled ]; then
  echo "ERROR: connect the device by cable, unlock it, and enable Developer Mode (transport=$transport, developerMode=$developer_mode)." >&2
  exit 1
fi

uninstall() {
  xcrun devicectl device uninstall app --device "$DEVICE" "$APP_ID" >/dev/null 2>&1 || true
  xcrun devicectl device uninstall app --device "$DEVICE" "$RUNNER_ID" >/dev/null 2>&1 || true
}

echo '[1/4] アプリを削除'
uninstall

echo '[2/4] 開発ビルドを作成'
# 署名のプロファイルに対象の端末を含めるため、端末を宛先にしてビルドする。
xcodebuild build-for-testing -project "$PROJECT" -scheme knittingEditor \
  -destination "platform=iOS,id=$DEVICE" -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" > "$OUT/build.log" 2>&1 \
  || { echo "ERROR: build failed. See $OUT/build.log" >&2; exit 1; }

echo '[3/4] UIテストを実行'
# 一覧の1行が1つのテスト。名前に空白は無いので、ここでは語の分割をそのまま使う。
only=$(grep -v -e '^[[:space:]]*#' -e '^[[:space:]]*$' "$LIST" | sed 's|^|-only-testing:knittingEditorUITests/|')
status=0
# 再試行と時間の上限は、CIの`ios`ジョブと同じにする。
# shellcheck disable=SC2086
xcodebuild test-without-building -project "$PROJECT" -scheme knittingEditor \
  -destination "platform=iOS,id=$DEVICE" -derivedDataPath "$DERIVED" -resultBundlePath "$RESULT" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" \
  -retry-tests-on-failure -test-iterations 2 -test-timeouts-enabled YES \
  -default-test-execution-time-allowance 150 -maximum-test-execution-time-allowance 240 \
  $only > "$OUT/test.log" 2>&1 || status=$?

if [ -d "$RESULT" ]; then
  xcrun xcresulttool export attachments --path "$RESULT" --output-path "$OUT/attachments" >/dev/null 2>&1 \
    || echo 'WARNING: could not export attachments.' >&2
fi

echo '[4/4] アプリを入れ直して、テストが作った編み図を消す'
uninstall
app=$(find "$DERIVED/Build/Products" -maxdepth 2 -path '*-iphoneos/knittingEditor.app' -print -quit)
if [ -z "$app" ] || ! xcrun devicectl device install app --device "$DEVICE" "$app" >/dev/null 2>&1; then
  echo 'WARNING: could not reinstall the app. Install it again before checking issues by hand.' >&2
fi

# 再試行で通ったテストも、初めの失敗を調べられるように出す（AGENTS.mdの断続的な失敗の扱い）。
grep -E "Test Case '.*' failed \(|automation mode|Testing failed" "$OUT/test.log" || true
if [ -d "$RESULT" ]; then
  xcrun xcresulttool get test-results summary --path "$RESULT" --compact 2>/dev/null \
    | jq -r '"結果: \(.result)（成功 \(.passedTests)、失敗 \(.failedTests)、スキップ \(.skippedTests)、計 \(.totalTestCount)）"' || true
fi
echo "出力: $OUT"
exit "$status"
