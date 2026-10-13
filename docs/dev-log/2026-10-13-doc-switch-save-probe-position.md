# 2026-10-13 — 文書切替の保存テストを、セルの位置で確かめる

- 影響: iOSのUIテスト`testDocumentSwitchSavesWithoutAutosave`が、mainのFull iOS validation（`37ca568`）でiPhoneだけ時々失敗した（同じコードを含む別の実行では成功）。盤面の初期位置は、文書を開いたときの盤面の大きさから決まる（`packages/editor-core/canvas/BoardCanvas.tsx`の`initialViewport`）。テストは盤面の幅・高さに対する割合でタップしていたため、描いたときと再起動後で盤面の大きさが違うと、同じ割合が別のマスを指していた。テストは段・目で指定したマスの中心をタップし、キーボードやパネルが閉じて盤面の位置と大きさが落ち着いてから操作する。消去モードへの切り替わりも待つ。2文書の作成・切替・再起動を1本で行うため、このテストだけ実行時間の上限を240秒にした。アプリの動作は変えていない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`。
- テスト: 自動保存を1時間遅らせた状態で、文書の切替だけで保存され、再起動後に同じ3つのマスに記号が残っていること（各マスを消して数が減り、取り消しで戻ること）を確かめる内容はそのまま。失敗時は画面写真と盤面・マスの座標を残す。
- 検証（Node 24）: `npm run typecheck`、`npm test`（575件）、`npm run build`、`npm run check:dist`、`node scripts/check-pr-smoke-ui-tests.mjs`、`git diff --check`、`xcrun swiftc -frontend -parse`が成功。iPhone 17のSimulatorで`-only-testing:knittingEditorUITests/KnittingEditorUITests/testDocumentSwitchSavesWithoutAutosave -test-iterations 3`が3回とも成功（1回124〜132秒）。iPadと他のテストは、このブランチのFull iOS validationで確かめる。
- デプロイ影響: none。テストだけの変更。
