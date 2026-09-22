#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
simulator_name="${1:-iPhone 16}"
destination="${2:-platform=iOS Simulator,name=${simulator_name},OS=latest}"
bundle_id="com.k0mork.knittingEditor"
work_dir="${TMPDIR:-/tmp}/knitting-editor-app-update-${simulator_name//[^[:alnum:]]/-}"
updated_derived_data="$work_dir/updated-derived-data"
probe_marker="/tmp/knitting-editor-app-update-probe"

find_simulator_udid() {
  local device_list="$1"
  while IFS= read -r line; do
    [[ "$line" == *"$simulator_name"* ]] || continue
    printf '%s\n' "$line" | grep -Eo '[[:xdigit:]]{8}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{4}-[[:xdigit:]]{12}' | head -n 1
    return 0
  done <<< "$device_list"
}

simulator_udid="${SIMULATOR_UDID:-}"
if [[ -z "$simulator_udid" ]]; then
  simulator_udid="$(find_simulator_udid "$(xcrun simctl list devices available)")"
fi
if [[ -z "$simulator_udid" ]]; then
  echo "Simulatorが見つかりません: $simulator_name" >&2
  exit 1
fi
# 同名Simulatorが複数ある環境でも、データ消去・初回保存・更新後確認を
# 同じ個体に固定する。名前指定のdestinationはxcodebuildが別UDIDを選ぶ
# 可能性があるため、検出済みUDIDへ正規化する。
destination="platform=iOS Simulator,id=${simulator_udid}"

# 1テストあたりの実行時間上限は、遅いランナーでの実測に合わせる。fixture作成は
# ダイアログ入力と自動保存待ちを含み、GitHubのmacOSランナーで178秒かかって
# 既定の2分を超えたことがある（テスト自体は成功していたのに`Failing tests:`へ載る）。
# 本当のハングはジョブの`timeout-minutes`が捕まえる。
rm -rf "$work_dir"
mkdir -p "$work_dir"
touch "$probe_marker"
trap 'rm -f "$probe_marker"' EXIT

echo "[1/4] 専用Simulatorの既存アプリデータを消去: $simulator_udid"
xcrun simctl uninstall "$simulator_udid" "$bundle_id" >/dev/null 2>&1 || true

echo "[2/4] version 1でfixtureを保存"
(
  cd "$project_root"
  xcodebuild test \
    -project knittingEditor.xcodeproj \
    -scheme knittingEditor \
    -destination "$destination" \
    -retry-tests-on-failure \
    -test-iterations 2 \
    -test-timeouts-enabled YES \
    -default-test-execution-time-allowance 180 \
    -maximum-test-execution-time-allowance 240 \
    -only-testing:knittingEditorUITests/KnittingEditorUITests/testSeedDocumentForAppUpdateProbe \
    CODE_SIGNING_ALLOWED=NO
)

echo "[3/4] version 2を同一Bundle IDでビルドして上書きインストール"
(
  cd "$project_root"
xcodebuild build-for-testing \
    -project knittingEditor.xcodeproj \
    -scheme knittingEditor \
    -sdk iphonesimulator \
    -configuration Debug \
    -derivedDataPath "$updated_derived_data" \
    CURRENT_PROJECT_VERSION=2 \
    CODE_SIGNING_ALLOWED=NO
)
updated_app="$updated_derived_data/Build/Products/Debug-iphonesimulator/knittingEditor.app"
xcrun simctl boot "$simulator_udid" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$simulator_udid" -b
xcrun simctl install "$simulator_udid" "$updated_app"
updated_xctestrun="$(find "$updated_derived_data/Build/Products" -name '*.xctestrun' -print -quit)"
if [[ -z "$updated_xctestrun" ]]; then
  echo "更新ビルドのxctestrunが見つかりません" >&2
  exit 1
fi

echo "[4/4] version 2でfixtureが復元されることを確認"
(
  cd "$project_root"
  xcodebuild test-without-building \
    -xctestrun "$updated_xctestrun" \
    -destination "$destination" \
    -retry-tests-on-failure \
    -test-iterations 2 \
    -test-timeouts-enabled YES \
    -default-test-execution-time-allowance 180 \
    -maximum-test-execution-time-allowance 240 \
    -only-testing:knittingEditorUITests/KnittingEditorUITests/testUpdatedAppRestoresSeedDocument \
    CODE_SIGNING_ALLOWED=NO
)

echo "アプリ更新シミュレーション成功: $simulator_name"
