#!/bin/sh
# 実機でブリッジの変換とファイル入出力を測る（REAL_DEVICE_RELEASE_CHECKLIST.mdのM2）。
#
#   KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX ios/scripts/measure-bridge-io.sh <UDID> <small|medium|large>
#
# UIテスト`testBridgeIOOnRealDevice`を実行しながら、Instrumentsの
# Activity Monitorで端末の全プロセスを記録し、アプリとWebKitのプロセスの
# 最大メモリ（物理フットプリント）を表示する。盤面データはアプリ本体ではなく
# WebKitのコンテンツプロセスにあるため、アプリ本体の値だけでは測れない。
# ブリッジ区間の所要時間は、DEBUGビルドのアプリが書く区間ファイルを端末から取り出して集計する。
# UIテスト中はXCUITestのsignpostでアプリのsignpostバッファがあふれ、xctraceの記録から
# 前半の区間が落ちるため。os_signpostとHangsは記録に残し、Instrumentsで見られるようにする。
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
INTERVALS="$OUT/bridge-io-intervals.tsv"
rm -rf "$TRACE" "$OUT/bridge-io.xcresult" "$INTERVALS"

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

# アプリはKNITTING_EDITOR_BRIDGE_IO_SIZEがあるDEBUG起動でだけ、区間ごとに1行を書く（BridgeIntervalLog）。
# テストが失敗しても途中までの区間を取り出す。
if xcrun devicectl device copy from --device "$DEVICE" --domain-type appDataContainer \
  --domain-identifier com.k0mork.knittingEditor --source Library/Caches/bridge-io-intervals.tsv \
  --destination "$INTERVALS" > "$OUT/devicectl-copy.log" 2>&1 && [ -s "$INTERVALS" ]; then
  /usr/bin/python3 "$SCRIPT_DIR/summarize-bridge-intervals.py" "$INTERVALS" || status=1
else
  echo "ERROR: could not fetch the interval file from the device. See $OUT/devicectl-copy.log" >&2
  status=1
fi

# 以下の集計は参考情報。失敗しても終了コードは変えない。
xcrun xctrace export --input "$TRACE" \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="activity-monitor-process-live"]' \
  > "$OUT/process-live.xml" 2>/dev/null \
  && /usr/bin/python3 "$SCRIPT_DIR/summarize-process-memory.py" "$OUT/process-live.xml" \
  || echo 'WARNING: could not summarize process memory; inspect the trace with Instruments.' >&2
# WebKitは他アプリ由来も含め全候補を表示する。WebKitのresponsible-processはlaunchdなので、
# 所属はPIDの近さとInstrumentsで確認する。
# スキーマ名はXcodeで変わるため、TOCを保存し、存在するHangsの表だけを書き出す。
# os_signpostの表は開始・終了のイベント表で所要時間を持たないため、集計せずInstrumentsで見る。
hang_found=0
if xcrun xctrace export --input "$TRACE" --toc > "$OUT/toc.xml" 2>/dev/null; then
  for schema in potential-hangs hang-risks; do
    grep -q "schema=\"$schema\"" "$OUT/toc.xml" || continue
    hang_found=1
    xcrun xctrace export --input "$TRACE" \
      --xpath "/trace-toc/run[@number=\"1\"]/data/table[@schema=\"$schema\"]" > "$OUT/$schema.xml" 2>/dev/null \
      && /usr/bin/python3 "$SCRIPT_DIR/summarize-bridge-intervals.py" --hangs "$OUT/$schema.xml" \
      || echo "WARNING: could not summarize $schema; inspect the trace with Instruments." >&2
  done
fi
if [ "$hang_found" -eq 0 ]; then
  echo 'WARNING: no potential-hangs/hang-risks table; inspect the trace with Instruments.' >&2
fi
# 既存のlarge-board手順と同様、クラッシュ/Jetsamログの取得は自動化していない。
echo "Trace and logs (local only): $OUT"

exit "$status"
