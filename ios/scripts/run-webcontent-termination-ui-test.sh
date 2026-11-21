#!/usr/bin/env bash
# WebContent終了中の共有シート・保存画面・VoiceOver表示をSimulatorで確認する。
#
#   ios/scripts/run-webcontent-termination-ui-test.sh "KE verify iPhone"
#   ios/scripts/run-webcontent-termination-ui-test.sh "KE verify iPhone" \
#     KnittingEditorUITests/testShareSheetSurvivesWebContentTermination
#
# 引数を省略すると、WebContent終了のUIテスト4件をまとめて実行する。UIテストは
# `TEST_RUNNER_KNITTING_EDITOR_WEBCONTENT_KILL=1`があるときだけ動作し、CIではskipする。
# テストが`NSLog`で合図を出すと、このスクリプトが対象Simulatorの
# `com.apple.WebKit.WebContent`をSIGKILLし、`/tmp/knitting-editor-webcontent-kill-done`を作る。
# テストはそのファイルを待って、終了が実際に起きたことを確かめる。
#
# このスクリプトは対象SimulatorのWebContentプロセスをすべて終了させる。ほかのアプリ
# （Safariなど）を開いていない、専用の検証用Simulatorで実行する。
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
simulator_name="${1:-KE verify iPhone}"
shift || true
if [[ $# -eq 0 ]]; then
  tests=(
    "KnittingEditorUITests/testLargeChartRecoversFromWebContentTerminationInBackground"
    "KnittingEditorUITests/testShareSheetSurvivesWebContentTermination"
    "KnittingEditorUITests/testDocumentPickerSurvivesWebContentTermination"
    "KnittingEditorUITests/testRecoveryAccessibilityExposesPreparingNoticeAndRetry"
  )
else
  tests=("$@")
fi

udid="$("$project_root/scripts/boot-simulator.sh" "$simulator_name")"
xcrun simctl bootstatus "$udid" -b

work_dir="${TMPDIR:-/tmp}/knitting-editor-webcontent-${udid}"
signal_file="/tmp/knitting-editor-webcontent-kill-done"
signal_file_device="/tmp/knitting-editor-webcontent-kill-done-${udid}"
rm -rf "$work_dir"
mkdir -p "$work_dir"
signal_log="$work_dir/signals.log"
xcodebuild_log="$work_dir/xcodebuild.log"
result_bundle="$work_dir/TestResults.xcresult"
rm -f "$signal_file" "$signal_file_device"

# テストはXcodeGenで生成したプロジェクトを使う。Web資産はビルドフェーズが作る。
(cd "$project_root" && xcodegen generate --spec project.yml --quiet)

# 対象SimulatorのWebContentはlaunchd_simの子プロセスとして動く。名前だけで選ぶと
# 同じMacのSafariや他のSimulatorのWebContentも終了してしまうため、親をUDIDで絞る。
webcontent_pids() {
  local launchd_pid
  launchd_pid="$(pgrep -f "launchd_sim.*${udid}" | awk 'NR == 1' || true)"
  [[ -n "$launchd_pid" ]] || return 0
  pgrep -P "$launchd_pid" -f 'com.apple.WebKit.WebContent' || true
}

kill_webcontent() {
  local pids pid attempt alive
  for _ in {1..50}; do
    pids="$(webcontent_pids)"
    if [[ -n "$pids" ]]; then
      echo "WebContentを終了: $(echo "$pids" | tr '\n' ' ')"
      while IFS= read -r pid; do
        if [[ -n "$pid" ]]; then
          # `pgrep`のあとに終了していることがある。`set -e`で止めない。
          kill -9 "$pid" 2>/dev/null || true
        fi
      done <<< "$pids"
      # SIGKILLが届いてもプロセス表から消えるまで時間がかかる。消えるまで待つ。
      for ((attempt = 0; attempt <= 50; attempt++)); do
        alive=0
        while IFS= read -r pid; do
          if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            alive=1
            break
          fi
        done <<< "$pids"
        if [[ $alive -eq 0 ]]; then
          return 0
        fi
        if (( attempt < 50 )); then
          sleep 0.1
        fi
      done
      echo "WebContentが終了しない: $(echo "$pids" | tr '\n' ' ')" >&2
      return 1
    fi
    sleep 0.2
  done
  echo "WebContentプロセスが見つかりません: $simulator_name ($udid)" >&2
  return 1
}

stream_pid=""
test_pid=""
cleanup() {
  if [[ -n "$test_pid" ]] && kill -0 "$test_pid" 2>/dev/null; then
    kill "$test_pid" 2>/dev/null || true
    for _ in {1..20}; do
      kill -0 "$test_pid" 2>/dev/null || break
      sleep 0.1
    done
    if kill -0 "$test_pid" 2>/dev/null; then
      kill -9 "$test_pid" 2>/dev/null || true
    fi
  fi
  if [[ -n "$stream_pid" ]]; then
    pkill -P "$stream_pid" 2>/dev/null || true
    kill "$stream_pid" 2>/dev/null || true
  fi
  rm -f "$signal_file" "$signal_file_device"
}
trap cleanup EXIT

# UIテストが出す合図だけを拾う。`--last`は使わず、この実行より前のログを混ぜない。
xcrun simctl spawn "$udid" log stream --style compact \
  --predicate 'eventMessage CONTAINS "KNITTING_EDITOR_WEBCONTENT_KILL_READY"' \
  > "$signal_log" 2>/dev/null &
stream_pid=$!
sleep 1

selections=()
test_methods=()
for test in "${tests[@]}"; do
  # `-only-testing:`はターゲット名（knittingEditorUITests）から始める。
  case "$test" in
    */*/*) selections+=("-only-testing:$test") ;;
    */*) selections+=("-only-testing:knittingEditorUITests/$test") ;;
    *) selections+=("-only-testing:knittingEditorUITests/KnittingEditorUITests/$test") ;;
  esac
  # ログの検証には、引数の3つの形式（method、Class/method、Target/Class/method）の
  # どれからでもメソッド名だけを取り出す。
  test_methods+=("${test##*/}")
done

# xcodebuildが0で終わっても、選んだテストがskipされたり実行されなかったりすると
# 成功に見えてしまう。各メソッドのpassedとskipの有無をログで確かめる。
verify_test_results() {
  local log="$1"
  local passed=0
  local method
  local line
  local missing=()
  local skipped=()
  local skipped_lines

  skipped_lines="$(grep -E "Test Case '.*' skipped" "$log" || true)"
  if [[ -n "$skipped_lines" ]]; then
    while IFS= read -r line; do
      [[ -n "$line" ]] && skipped+=("$line")
    done <<< "$skipped_lines"
  fi
  for method in "${test_methods[@]}"; do
    if grep -Fq "Test Case '-[knittingEditorUITests.KnittingEditorUITests $method]' passed" "$log"; then
      passed=$((passed + 1))
    else
      missing+=("$method")
    fi
  done

  if (( ${#skipped[@]} > 0 )); then
    echo "skipされたテスト:" >&2
    printf '  %s\n' "${skipped[@]}" >&2
  fi
  if (( ${#missing[@]} > 0 )); then
    echo "passedを確認できないテスト:" >&2
    printf '  %s\n' "${missing[@]}" >&2
  fi
  if (( ${#skipped[@]} > 0 || ${#missing[@]} > 0 )); then
    echo "失敗: $simulator_name (passed $passed/${#test_methods[@]}, skipped ${#skipped[@]})" >&2
    return 1
  fi
  echo "成功: $simulator_name (passed $passed/${#test_methods[@]}, skipped 0)"
}

export TEST_RUNNER_KNITTING_EDITOR_WEBCONTENT_KILL=1
xcodebuild test \
  -project "$project_root/knittingEditor.xcodeproj" \
  -scheme knittingEditor \
  -destination "platform=iOS Simulator,id=$udid" \
  -derivedDataPath "$work_dir/DerivedData" \
  -resultBundlePath "$result_bundle" \
  -retry-tests-on-failure \
  -test-iterations 2 \
  -test-timeouts-enabled YES \
  -default-test-execution-time-allowance 300 \
  -maximum-test-execution-time-allowance 600 \
  "${selections[@]}" \
  CODE_SIGNING_ALLOWED=NO \
  > "$xcodebuild_log" 2>&1 &
test_pid=$!

seen=0
while kill -0 "$test_pid" 2>/dev/null; do
  total="$(
    grep -o 'KNITTING_EDITOR_WEBCONTENT_KILL_READY [0-9A-Fa-f-]*' "$signal_log" 2>/dev/null \
      | awk '!seen[$0]++' | wc -l | tr -d ' ' || true
  )"
  total="${total:-0}"
  while (( seen < total )); do
    seen=$((seen + 1))
    echo "[$seen] WebContent終了の合図を受け取りました"
    if ! kill_webcontent; then
      kill "$test_pid" 2>/dev/null || true
      break 2
    fi
    printf 'killed\n' > "$signal_file"
    printf 'killed\n' > "$signal_file_device"
  done
  sleep 0.2
done

status=0
wait "$test_pid" || status=$?
# waitで回収済みなら、PIDの再利用でcleanupが別のプロセスを止めないよう空にする。
if ! kill -0 "$test_pid" 2>/dev/null; then
  test_pid=""
fi
if [[ $status -eq 0 ]]; then
  if ! verify_test_results "$xcodebuild_log"; then
    echo "失敗: $simulator_name（ログ: $xcodebuild_log）" >&2
    tail -n 80 "$xcodebuild_log" >&2
    exit 1
  fi
  echo "結果: $result_bundle"
else
  echo "失敗: $simulator_name（ログ: $xcodebuild_log）" >&2
  tail -n 80 "$xcodebuild_log" >&2
fi
exit "$status"
