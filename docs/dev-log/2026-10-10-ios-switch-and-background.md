# 2026-10-10 — iOSの文書切替とバックグラウンド保存の回帰検査

- 影響: #196の回帰検査を強化。製品の動作は変更しない。文書切替の検査はAを記号1個、Bを別の位置の記号2個にし、切替後と再起動後の名前、記号数、配置位置を照合する。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`ios/Web/src/App.backgroundSave.test.tsx`。
- テスト: XCUITest `testDocumentSwitchAutosavesEachDocument`を更新。iOS WebにAppを実際にマウントする7件を追加。描画部分のみ代替し、実際のcontroller、session、IndexedDBを通す。400msの自動保存を進めず、登録された関数とイベントからセル配列が保存されること、pendingでは追加編集を未保存のまま保持すること、failedではfalseと背景移行時の通知が出ること、アンマウント時に関数と購読が解除されることを確認する。他の所有者が登録した関数を削除しないことも検査する。
- 検証: `npm ci`、`npm run typecheck`、`npm test`（37ファイル、259件）、`npm run build`、`npm run check:dist`が成功。`(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`、`(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`（9ファイル、41件）、`(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts src/App.backgroundSave.test.tsx)`（7件）が成功。`xcrun swiftc -frontend -parse ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`git diff --check`が成功。Swiftの構文検査はビルドや実行の代わりではない。SandboxでブラウザとSimulatorを起動できないため、Chromium/WebKitの`npm run test:e2e`、XcodeGen、iPhone/iPadのアプリビルド・XCUITest、app-update、unsigned Release Archive、offline bundle inspectionは検証担当とPR CIに委ねる。
- 残り: Home移行前の未保存状態を保証するXCUITestは未追加。既存の保存遅延制御がなく、通常のXCUITest操作では400ms以内の移行を保証できない。テストのみの変更を維持するため、製品側のテスト用フックは追加しない。XCUITestの記号色の違いも未追加で、今回は個数と位置を区別する。#196は部分対応であり、これらを満たすまでは`Closes #196`を付けない。実機でのサスペンド保証は別途確認する。
- デプロイ影響: なし。テストのみであり、Pages配信物とアプリの動作は変わらない。配信後の追加確認は不要。
