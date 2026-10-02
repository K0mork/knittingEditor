#!/usr/bin/env bash
# 指定した名前のSimulatorを、最新のiOSランタイムから選んで起動し、UDIDを標準出力へ出す。
#
#   udid="$(ios/scripts/boot-simulator.sh 'iPhone 17')"
#   xcrun simctl bootstatus "$udid" -b
#
# xcodebuildに起動を任せると、ビルドが終わってから初回起動（約2.5分）を始め、
# 終わった直後にテストを走らせる。起動直後のSimulatorは裏で初期化処理を続けており、
# CIではその間にXCUITestの要素検索1回が数十秒かかって、1テストの実行時間上限を
# 超えることがあった（タイムアウトは`-retry-tests-on-failure`の再試行対象外）。
# ジョブの最初に起動しておけば、ビルドの間に落ち着く。
#
# 起動の完了は待たない。待つときは`xcrun simctl bootstatus <udid> -b`を使う。
set -euo pipefail

simulator_name="${1:?Simulator名を指定してください（例: 'iPhone 17'）}"

# `-destination 'name=...,OS=latest'`と同じ個体を選ぶ。同名の端末は古いランタイムにも
# あるので、iOSランタイムの版が最も新しいものを採る。
udid="$(
  xcrun simctl list devices available --json | SIMULATOR_NAME="$simulator_name" /usr/bin/python3 -c '
import json, os, re, sys
name = os.environ["SIMULATOR_NAME"]
candidates = []
for runtime, devices in json.load(sys.stdin)["devices"].items():
    match = re.search(r"\.iOS-(\d+(?:-\d+)*)$", runtime)
    if not match:
        continue
    version = tuple(int(part) for part in match.group(1).split("-"))
    candidates += [(version, device["udid"]) for device in devices if device["name"] == name]
if candidates:
    version, udid = max(candidates)
    # どのランタイムの個体を使ったかをCIのログに残す。標準出力はUDIDだけにする。
    print("%s: iOS %s (%s)" % (name, ".".join(map(str, version)), udid), file=sys.stderr)
    print(udid)
'
)"
if [[ -z "$udid" ]]; then
  echo "Simulatorが見つかりません: $simulator_name" >&2
  exit 1
fi

# 起動済みならsimctlは失敗を返すので、状態を見てから起動する。
if ! xcrun simctl list devices | grep -F "($udid) (Booted)" >/dev/null; then
  xcrun simctl boot "$udid"
fi
echo "$udid"
