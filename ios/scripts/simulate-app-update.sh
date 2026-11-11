#!/usr/bin/env bash
# 前のリリースのアプリが保存した編み図が、今のコミットのアプリへ更新したあとも残ることを確かめる。
#
#   SIMULATOR_UDID=<UDID> ios/scripts/simulate-app-update.sh "iPhone 17"
#
# 更新前のアプリとfixtureを作るテストは、今のコミットから辿れる最新のリリースのタグ
# （`ios-v<版>-build<番号>`、RELEASE_RUNBOOK.mdの手順5の7）から作る。別のコミットや
# タグから始めるときは`APP_UPDATE_BASE_REF`に指定する。更新後に読むテストは今のコミットのもので、
# 前のリリースのfixture（編み図「アプリ更新復元fixture」と記号1個）を読めなければならない。
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_root="$(cd "$project_root/.." && pwd)"
simulator_name="${1:-iPhone 17}"
destination="${2:-platform=iOS Simulator,name=${simulator_name},OS=latest}"
bundle_id="com.k0mork.knittingEditor"
work_dir="${TMPDIR:-/tmp}/knitting-editor-app-update-${simulator_name//[^[:alnum:]]/-}"
base_root="$work_dir/base"
base_derived_data="$work_dir/base-derived-data"
updated_derived_data="$work_dir/updated-derived-data"
probe_marker="/tmp/knitting-editor-app-update-probe"

simulator_udid="${SIMULATOR_UDID:-}"
if [[ -z "$simulator_udid" ]]; then
  # `ios`ジョブの`OS=latest`と同じく、最新のiOSランタイムの個体を選んで起動する。
  simulator_udid="$("$project_root/scripts/boot-simulator.sh" "$simulator_name")"
fi
# 同名Simulatorが複数ある環境でも、データ消去・初回保存・更新後確認を
# 同じ個体に固定する。名前指定のdestinationはxcodebuildが別UDIDを選ぶ
# 可能性があるため、検出済みUDIDへ正規化する。
destination="platform=iOS Simulator,id=${simulator_udid}"

# 1テストあたりの実行時間上限は、遅いランナーでの実測に合わせる。fixture作成は
# ダイアログ入力と自動保存待ちを含み、GitHubのmacOSランナーで178秒かかって
# 既定の2分を超えたことがある（テスト自体は成功していたのに`Failing tests:`へ載る）。
# 本当のハングはジョブの`timeout-minutes`が捕まえる。
base_ref="${APP_UPDATE_BASE_REF:-}"
if [[ -z "$base_ref" ]]; then
  # `head`で読むのをやめるとgitがSIGPIPEで終わり、pipefailで止まるため、awkで全部読む。
  base_ref="$(git -C "$repo_root" tag --merged HEAD --list 'ios-v*' --sort=-v:refname | awk 'NR == 1')"
fi
if [[ -z "$base_ref" ]] || ! git -C "$repo_root" rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null; then
  echo "前のリリースのタグが見つかりません。履歴とタグを取得する（CIではcheckoutのfetch-depth: 0）か、APP_UPDATE_BASE_REFを指定してください。" >&2
  exit 1
fi

rm -rf "$work_dir"
mkdir -p "$work_dir" "$base_root"
touch "$probe_marker"
trap 'rm -f "$probe_marker"' EXIT

# 起動直後のSimulatorは裏で初期化処理を続け、fixture作成の操作1つが数十秒かかって
# 実行時間上限を超えたことがある。起動の完了を待ってからテストへ進む。
# 停止中の端末では`simctl uninstall`が失敗して、消去が黙って飛ばされる点も防ぐ。
xcrun simctl boot "$simulator_udid" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$simulator_udid" -b

echo "[1/5] 専用Simulatorの既存アプリデータを消去: $simulator_udid"
xcrun simctl uninstall "$simulator_udid" "$bundle_id" >/dev/null 2>&1 || true

echo "[2/5] 前のリリース（${base_ref}）のソースを取り出す"
git -C "$repo_root" archive "$base_ref" | tar -x -C "$base_root"
# タグのproject.ymlからXcodeプロジェクトを作り直す。XcodeGenが無ければ、タグにコミットされたものを使う。
if command -v xcodegen >/dev/null 2>&1; then
  xcodegen generate --spec "$base_root/ios/project.yml" --quiet
fi

echo "[3/5] 前のリリースのアプリでfixtureを保存"
(
  cd "$base_root/ios"
  xcodebuild test \
    -project knittingEditor.xcodeproj \
    -scheme knittingEditor \
    -destination "$destination" \
    -derivedDataPath "$base_derived_data" \
    -retry-tests-on-failure \
    -test-iterations 2 \
    -test-timeouts-enabled YES \
    -default-test-execution-time-allowance 180 \
    -maximum-test-execution-time-allowance 240 \
    -only-testing:knittingEditorUITests/KnittingEditorUITests/testSeedDocumentForAppUpdateProbe \
    CODE_SIGNING_ALLOWED=NO
)

echo "[4/5] 今のコミットのアプリを同一Bundle IDでビルドして上書きインストール"
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

echo "[5/5] 今のコミットのアプリでfixtureが復元されることを確認"
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

echo "アプリ更新シミュレーション成功（${base_ref} から）: $simulator_name"
