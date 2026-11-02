#!/bin/sh
# 実機でブリッジの変換とファイル入出力を測る（REAL_DEVICE_RELEASE_CHECKLIST.mdのM2）。
#
#   KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX ios/scripts/measure-bridge-io.sh <UDID> <small|medium|large>
#
# UIテスト`testBridgeIOOnRealDevice`を実行しながら、Instrumentsの
# Activity Monitorで端末の全プロセスを記録し、アプリとWebKitのプロセスの
# 最大メモリ（物理フットプリント）を表示する。盤面データはアプリ本体ではなく
# WebKitのコンテンツプロセスにあるため、アプリ本体の値だけでは測れない。
# 端末では「設定 > デベロッパ > UIオートメーションを有効にする」を先にオンにしておく。
set -eu

if [ $# -lt 2 ]; then
  echo "usage: KNITTING_EDITOR_DEVELOPMENT_TEAM=<TeamID> $0 <device UDID> <small|medium|large> [output directory]" >&2
  exit 2
fi
DEVICE=$1
SIZE=$2
case "$SIZE" in small|medium|large) ;; *) echo 'ERROR: size must be small, medium, or large' >&2; exit 2 ;; esac
TEAM=${KNITTING_EDITOR_DEVELOPMENT_TEAM:-}
if [ -z "$TEAM" ]; then
  echo 'ERROR: set KNITTING_EDITOR_DEVELOPMENT_TEAM to the 10-character Apple Team ID.' >&2
  exit 2
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT="$SCRIPT_DIR/../knittingEditor.xcodeproj"
OUT=${3:-$(mktemp -d "${TMPDIR:-/tmp}/knitting-bridge-io.XXXXXX")}
mkdir -p "$OUT"
TRACE="$OUT/bridge-io.trace"
rm -rf "$TRACE" "$OUT/bridge-io.xcresult"

# 署名のプロファイルに対象の端末を含めるため、端末を宛先にしてビルドする。
xcodebuild build-for-testing -project "$PROJECT" -scheme knittingEditor \
  -destination "platform=iOS,id=$DEVICE" -derivedDataPath "$OUT/DerivedData" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" > "$OUT/build.log" 2>&1 \
  || { echo "ERROR: build failed. See $OUT/build.log" >&2; exit 1; }

# この環境のxctrace help recordには--instrumentがあるがlist instrumentsは空。
# 実機接続済みのMacでos_signpost / Hangsの名称と併用を必ず確認する。
xcrun xctrace record --template 'Activity Monitor' --instrument 'os_signpost' --instrument 'Hangs' --device "$DEVICE" --all-processes \
  --time-limit 35m --output "$TRACE" > "$OUT/xctrace.log" 2>&1 &
trace_pid=$!
# 記録が始まる前にアプリが起動すると、起動直後の値を取りこぼす。
sleep 15
if ! kill -0 "$trace_pid" 2>/dev/null; then
  echo "ERROR: trace did not start; confirm instrument availability. See $OUT/xctrace.log" >&2
  exit 1
fi

status=0
TEST_RUNNER_KNITTING_EDITOR_BRIDGE_IO=1 TEST_RUNNER_KNITTING_EDITOR_BRIDGE_IO_SIZE="$SIZE" xcodebuild test-without-building -project "$PROJECT" \
  -scheme knittingEditor -destination "platform=iOS,id=$DEVICE" -derivedDataPath "$OUT/DerivedData" \
  -resultBundlePath "$OUT/bridge-io.xcresult" -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" \
  -only-testing:knittingEditorUITests/KnittingEditorUITests/testBridgeIOOnRealDevice \
  > "$OUT/test.log" 2>&1 || status=$?

sleep 5
# 保存には1分以上かかることがある。テストが起動前に失敗すると、xctraceは中断の合図の
# あと保存を終えずに止まることがあるため、5分待っても終わらなければ打ち切る。
kill -INT "$trace_pid" 2>/dev/null || true
waited=0
while kill -0 "$trace_pid" 2>/dev/null && [ "$waited" -lt 300 ]; do
  sleep 1
  waited=$((waited + 1))
done
if kill -0 "$trace_pid" 2>/dev/null; then
  echo 'WARNING: xctrace did not finish saving within 5 minutes; stopping it.' >&2
  kill -TERM "$trace_pid" 2>/dev/null || true
fi
wait "$trace_pid" 2>/dev/null || true

grep -E 'BRIDGEIO|Test Case .*(passed|failed)|automation mode' "$OUT/test.log" || true
if [ "$status" -ne 0 ]; then
  echo "ERROR: the test failed. See $OUT/test.log" >&2
fi

xcrun xctrace export --input "$TRACE" \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="activity-monitor-process-live"]' \
  > "$OUT/process-live.xml" 2>/dev/null

# WebKitは他アプリ由来も含め全候補を表示する。所属はInstrumentsで確認する。
/usr/bin/python3 "$SCRIPT_DIR/summarize-process-memory.py" "$OUT/process-live.xml"
# スキーマ名はXcodeで変わるため、TOCを保存し存在する区間表だけを書き出す。
xcrun xctrace export --input "$TRACE" --toc > "$OUT/toc.xml"
/usr/bin/python3 - "$OUT/toc.xml" <<'PYTOC' > "$OUT/interval-schemas.txt"
import sys
import xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
for schema in sorted({e.get('schema', '') for e in root.iter('table')}):
    if any(token in schema for token in ('signpost', 'hang')):
        print(schema)
PYTOC
if ! grep -q 'signpost' "$OUT/interval-schemas.txt"; then
  echo 'ERROR: no signpost table; inspect the trace with Instruments.' >&2
  exit 1
fi
while IFS= read -r schema; do
  xcrun xctrace export --input "$TRACE" \
    --xpath "/trace-toc/run[@number=\"1\"]/data/table[@schema=\"$schema\"]" > "$OUT/$schema.xml"
  /usr/bin/python3 "$SCRIPT_DIR/summarize-bridge-intervals.py" "$OUT/$schema.xml"
done < "$OUT/interval-schemas.txt"
if [ ! -s "$OUT/interval-schemas.txt" ]; then
  echo 'ERROR: no signpost/hang tables; inspect the trace with Instruments.' >&2
  exit 1
fi
# 既存のlarge-board手順と同様、クラッシュ/Jetsamログの取得は自動化していない。
echo "Trace and logs (local only): $OUT"

exit "$status"
