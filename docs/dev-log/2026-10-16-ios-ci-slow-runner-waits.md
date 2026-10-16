# 2026-10-16 — 遅いCI runnerでのiOSテストの待機を調整

- 影響: macos-26 runnerが遅い時間帯の不安定なテスト（#44、#274）に対し、WebContent起動と保存完了の待機を延長する。置き換えボタンは静止を待ち、保存シートの下スワイプと文字選択のダブルタップは、効かなかった場合だけ1回やり直す。
- 主なファイル: `ios/Tests/KnittingEditorAppTests/NativeExportResultTests.swift`、`ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: `testReportReachesWebPageAsCustomEvent`、`testBlockSaveAndFullBackupRestoreFollowGuide`、`testNewDocumentDialogFocusesNameInputWithoutTapping`と、保存シートを閉じる共通ヘルパー`dismissSystemSheet(in:)`を更新。
- 検証: 手元（Xcode 26、iPhone 17・iOS 26.5 Simulator、Node 26.8.1）で `npm ci`、`xcodegen generate --spec ios/project.yml` のあと、`xcodebuild test -only-testing:` で `NativeExportResultTests/testReportReachesWebPageAsCustomEvent`、`testBlockSaveAndFullBackupRestoreFollowGuide`、`testBackupExportSheetDismissesBackToEditor`、`testRestorePickerDismissesBackToEditor`、`testNewDocumentDialogFocusesNameInputWithoutTapping` を実行し、5件とも成功（`** TEST SUCCEEDED **`）。手元は速く、下スワイプとダブルタップのやり直しの経路は通っていない。`node scripts/check-pr-smoke-ui-tests.mjs` と `git diff --check` も成功。PRのCI（run 38857300964、`d7298ba`）とブランチでの `ios-full.yml`（`workflow_dispatch`、run 38857301468）は全ジョブが1回目で成功し、`Iteration 2 of 2`・実行時間上限の超過・テストランナーの再起動・再スワイプはなかった。遅いrunnerで効くかは、マージ後の #44 の観察で確かめる。
- デプロイ影響: なし。iOSのテストだけで、Pagesへの配信物は変わらない。
