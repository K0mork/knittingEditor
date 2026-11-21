# 2026-11-21 — 共有シートの文面をSimulatorで確かめる

- 影響: iOSアプリの共有シートで「ファイルに保存」と「コピー」に文面を渡さないことを、Simulatorで確かめた（#474）。アプリの動作は変えない。メールとメッセージに文面が付くことは、Simulatorにメールが無いため実機の確認に残す。
- 主なファイル: `ios/Tests/KnittingEditorAppTests/ShareCreditItemSourceTests.swift`、`ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`ios/App/ShareCreditItemSource.swift`（コメントのみ）
- テスト:
  - `ShareCreditItemSourceTests`に、iOS 27.2の「ファイルに保存」のrawValue（`com.apple.DocumentManagerUICore.SaveToFiles`）で文面を渡さないことを確かめるテストを足した。
  - `testShareSheetProbeSavesOnlyTheFileAndCopiesNoText`を足した（`KNITTING_EDITOR_SHARE_SHEET_PROBE=1`のときだけ実行し、CIではskipする）。PNGを共有シートの「コピー」に渡してペーストボードに文面が無いことを確かめ、続けて「“ファイル”に保存」（iOS 27では「表示を増やす」の先にある）で「このiPhone内」へ一意な名前で保存し、Filesの画面写真を残す。
- 検証:
  - KE verify iPhone（iPhone 17、iOS 27.2、Xcode 27.2）で`ShareCreditItemSourceTests`の7件と、`TEST_RUNNER_KNITTING_EDITOR_SHARE_SHEET_PROBE=1`を付けたUIテストが成功した。コピー後のペーストボードは`types=[public.png]`、`hasStrings=false`だった。
  - 「このiPhone内」の保存先（SimulatorのFile Provider Storage）には`share-probe-<id>.png`だけが保存され、`.txt`は無かった。
  - `node scripts/check-pr-smoke-ui-tests.mjs`、`npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`、`npm test`、`npm run typecheck`、`sh ios/scripts/check-app-store-docs.sh`が成功した。
- デプロイ影響: なし。テスト・コメント・開発ログだけの変更。
