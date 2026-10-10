# 2026-10-10 — バックアップ保存シートのCI除外を解除

- 影響: #193（Closes #193予定）。Xcode 15.4を理由に残っていた二重の除外を外し、現行のXcode 26.6のPR CIでバックアップ保存シートの往復を検証する。安定性とIssueの完了は、iPhone・iPad両方のPR CI結果で判断する。
- 主なファイル: `.github/workflows/ci.yml`、`ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 既存の`testBackupExportSheetDismissesBackToEditor`の`CI=true`時の`XCTSkip`を削除し、ワークフローの同テストの`-skip-testing`も削除した。シートの表示・閉じる操作・編集画面への復帰の検査と失敗時の画面添付は維持した。確認アラートのキャンセルは既存の`testPngAndPdfExportsReachNativeFileActions`が検証する。待機処理やワークフローのほかの設定は変更していない。
- 検証: `npm ci`成功、`npm run typecheck`成功、`npm test`成功（37ファイル、259テスト）、`npm run build`成功、`npm run check:dist`成功、`git diff --check`成功。Playwright（Chromium/WebKit）とiOSのビルド・Simulatorテストは手元では実行せず、PR CIで確認する。別の担当が差分を独立に確認し、除外の解除が2か所に限られ、ほかのテストと実行時コードに変更がないことを確かめた。iOS Webの型検査・テスト、XcodeGen、iPhone・iPadのSimulatorテスト、アプリ更新テスト、unsigned Release Archive、同梱物検査と`ci-gate`はPR CIで確認する。保存シートの対象テストは両端末で複数回実行し、スキップされていないことと成功を確認する。既存の`-retry-tests-on-failure -test-iterations 2`は失敗時の再試行であり、成功時の複数回実行を保証しないため、追加の反復実行が必要。
- デプロイ影響: アプリとWebの実行時挙動の変更はなし。ワークフロー変更はWeb・iOS検証対象となるため、mainへのマージ時は既存設定に従いPages配信も実行される。配信後は既存のdeploy・smokeの成功を確認する。
