#!/bin/sh
# 実機で1000×1000盤面の時間とメモリを測る（REAL_DEVICE_RELEASE_CHECKLIST.mdのM2）。
#
#   KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX ios/scripts/measure-large-board.sh <UDID>
#
# UIテスト`testLargeBoardSavesAndRestores`を実行しながら、Instrumentsの
# Activity Monitorで端末の全プロセスを記録し、アプリとWebKitのプロセスの
# 最大メモリ（物理フットプリント）を表示する。盤面データはアプリ本体ではなく
# WebKitのコンテンツプロセスにあるため、アプリ本体の値だけでは測れない。
# 端末では「設定 > デベロッパ > UIオートメーションを有効にする」を先にオンにしておく。
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

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PROJECT="$SCRIPT_DIR/../knittingEditor.xcodeproj"
OUT=${2:-$(mktemp -d "${TMPDIR:-/tmp}/knitting-large-board.XXXXXX")}
mkdir -p "$OUT"
TRACE="$OUT/large-board.trace"
rm -rf "$TRACE" "$OUT/large-board.xcresult"

# 署名のプロファイルに対象の端末を含めるため、端末を宛先にしてビルドする。
xcodebuild build-for-testing -project "$PROJECT" -scheme knittingEditor \
  -destination "platform=iOS,id=$DEVICE" -derivedDataPath "$OUT/DerivedData" \
  -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" > "$OUT/build.log" 2>&1 \
  || { echo "ERROR: build failed. See $OUT/build.log" >&2; exit 1; }

xcrun xctrace record --template 'Activity Monitor' --device "$DEVICE" --all-processes \
  --time-limit 15m --output "$TRACE" > "$OUT/xctrace.log" 2>&1 &
trace_pid=$!
# 記録が始まる前にアプリが起動すると、起動直後の値を取りこぼす。
sleep 15

status=0
TEST_RUNNER_KNITTING_EDITOR_LARGE_BOARD=1 xcodebuild test-without-building -project "$PROJECT" \
  -scheme knittingEditor -destination "platform=iOS,id=$DEVICE" -derivedDataPath "$OUT/DerivedData" \
  -resultBundlePath "$OUT/large-board.xcresult" -allowProvisioningUpdates DEVELOPMENT_TEAM="$TEAM" \
  -only-testing:knittingEditorUITests/KnittingEditorUITests/testLargeBoardSavesAndRestores \
  > "$OUT/test.log" 2>&1 || status=$?

sleep 5
kill -INT "$trace_pid" 2>/dev/null || true
wait "$trace_pid" || true

grep -E 'LARGEBOARD|Test Case .*(passed|failed)|automation mode' "$OUT/test.log" || true
if [ "$status" -ne 0 ]; then
  echo "ERROR: the test failed. See $OUT/test.log" >&2
  exit "$status"
fi

xcrun xctrace export --input "$TRACE" \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="activity-monitor-process-live"]' \
  > "$OUT/process-live.xml" 2>/dev/null

# 同じ名前のWebKitのプロセスは他のアプリにもある。アプリのWebKitのプロセスは
# アプリの直後に起動してPIDが続くため、アプリのPIDから少しの範囲だけを数える。
/usr/bin/python3 - "$OUT/process-live.xml" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

text = open(sys.argv[1], encoding='utf-8').read()
root = ET.fromstring(text[text.index('<?xml'):])
ids = {e.attrib['id']: e for e in root.iter() if 'id' in e.attrib}
resolve = lambda e: ids[e.attrib['ref']] if 'ref' in e.attrib else e
columns = [c.find('mnemonic').text for c in root.iter('col')]
peaks = {}
for row in root.iter('row'):
    cells = dict(zip(columns, (resolve(c) for c in row)))
    match = re.match(r'(.*) \((\d+)\)$', cells['process'].attrib.get('fmt', ''))
    if not match:
        continue
    name, pid = match.group(1), int(match.group(2))
    footprint = int(cells['memory-physical-footprint'].text)
    if footprint > peaks.get((name, pid), 0):
        peaks[(name, pid)] = footprint
apps = sorted(pid for name, pid in peaks if name == 'knittingEditor')
if not apps:
    sys.exit('ERROR: knittingEditor was not recorded in the trace')
print('最大メモリ（物理フットプリント）')
for app in apps:
    print(f'  knittingEditor ({app}): {peaks[("knittingEditor", app)] / 2**20:.1f} MiB')
    for (name, pid), footprint in sorted(peaks.items(), key=lambda item: item[0][1]):
        if name.startswith('com.apple.WebKit.') and app < pid <= app + 5:
            print(f'    {name} ({pid}): {footprint / 2**20:.1f} MiB')
PY
echo "Trace and logs: $OUT"
