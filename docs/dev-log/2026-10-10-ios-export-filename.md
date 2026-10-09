# 2026-10-10 — iOSの出力ファイル名を安全化

- 影響: #166（Closes #166）。編み図名とバックアップ内容を維持したまま、PNG・PDF・個別`.knit`をネイティブへ送る際のファイル名だけを安全化する。スラッシュ、バックスラッシュ、連続する点、制御文字を`_`に置換し、拡張子を保持して書記素単位で180文字以内に切り詰める。切り詰め後に拡張子と接して`..`になる末尾の点も置換する。Swiftの検証は変更しない。
- 主なファイル: `ios/Web/src/nativeBridge.ts`、`ios/Web/src/nativeBridge.test.ts`、`ios/Tests/KnittingEditorAppTests/NativeBridgeMessageTests.swift`、`ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`。
- テスト: 各拡張子について、Issueの名前、連続する点、Cc/Cf制御文字、180文字の境界、結合文字、絵文字、切り詰め位置の点と送信内容の維持をVitestで確認。Swift単体テストで危険な名前の拒否と安全な180文字の受理を追加。XCUITestを名前ごとに4件追加し、各形式がネイティブの保存・共有選択に到達し、キャンセル後も編み図名を保持することを確認する。
- 検証: 以下を実行し、すべて成功。
  - `npm ci`: 成功。
  - `npm run typecheck`: 成功。
  - `npm test`: 成功、37ファイル・259件。
  - `npm run build`: 成功。
  - `npm run check:dist`: 成功。
  - `(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`: 成功。
  - `(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`: 成功、8ファイル・67件。
  - `git diff --check`: 成功。
  - `npm run test:e2e`（Chromium/WebKit）、Swift単体テスト、iOSビルド・Simulatorテストはサンドボックスで実行できないため、検証担当とPR CIに委ねる。iOS全体のiPhone/iPad Simulator、更新テスト、unsigned Release Archive、オフライン同梱物検査もPR CIで確認する。
- デプロイ影響: Pagesはなし。iOSアプリの同梱Webに反映する。配布後は問題のある名前のPNG・PDF・個別`.knit`がFilesへ保存でき、元の編み図名が変わらないことを確認する。
