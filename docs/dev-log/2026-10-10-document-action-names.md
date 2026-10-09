# 2026-10-10 — 編み図一覧のボタンの読み上げ名に、表示の文字と編み図名を含める

- 影響: 「編み図」パネルの一覧の各行のボタンは、読み上げ名が固定の「名前変更」「複製」「削除」で、表示が「名称」のボタンは表示の文字を名前に含まず、どの行も同じ名前で対象の編み図が分からなかった（#189）。読み上げ名を「<編み図名>の名称を変更」「<編み図名>を複製」「<編み図名>を削除」にした。表示の文字（「名称」「複製」「削除」）は変えず、読み上げ名に含めるので、音声コントロールで表示どおりに呼んでも押せる。読み上げ名は描画のたびに編み図名から作るので、名前を変えると新しい名前になる。Web版とiOS版の両方に入る。
- 主なファイル: `packages/editor-core/ui/documentListText.ts`、`packages/editor-core/ui/DocumentList.tsx`
- テスト: Vitestの`documentListText.test.ts`に`documentActionName`のテスト（3つの読み上げ名と、それぞれが表示の文字を含むこと）を足した。`DocumentList.test.tsx`に、2つの編み図がある一覧で各ボタンの表示と読み上げ名を確かめ、読み上げ名で特定したボタンが対象の編み図を渡すこと、名前を変えたあとは新しい名前になることを確かめるテストを足し、既存のテストを新しい読み上げ名に合わせた。Playwrightの`tests/e2e/document-list.spec.ts`に、2つの編み図がある一覧でボタンを編み図名で特定し、名前の変更後に読み上げ名が追従すること、名前で特定した行だけが削除されることを確かめるテストを足した。既存のE2E（`document-list.spec.ts`と`editor.spec.ts`）で固定の名前でボタンを探していた箇所を、編み図名を含む名前に合わせた。
- 検証: `npm run typecheck`、`npm test`（37ファイル262件）、`npm run build`、`npm run check:dist`、iOS Webの型検査（`ios/Web`で`tsc -p tsconfig.app.json --noEmit`）とテスト（`vitest run --config vite.config.ts`、34件）、`npm run test:e2e`（chromium-mobile、webkit-mobile、chromium-desktopで167件成功、既存の4件はスキップ）を実行し、すべて成功した。iOSのXCUITestは足していない。XcodeGen、Simulatorのテスト、アプリのArchiveはPRのCIで確かめる（Swiftとビルド設定は変えていない）。
- デプロイ影響: Pagesへ配信される。配信後に`https://knittingeditor.com/`の「編み図」パネルで、各行のボタンの読み上げ名に編み図名が入っていることを確かめる。
