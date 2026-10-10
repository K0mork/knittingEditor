# 2026-10-10 — 全記号の互換メタデータを固定fixtureで検証

- 影響: Closes #192。全26永続IDのメタデータの意図しない変更をVitestで検出します。製品の動作とカタログは変更しません。
- 主なファイル: `packages/editor-core/stitches/catalog.test.ts`
- テスト: id、key、width、height、consumes、produces、category、standardStatus、standardReferenceの固定リテラルfixtureを追加しました。ID順に比較し、表示順に依存させません。既存のID一意性、カタログバージョン3、`.knit`復元の検証は維持します。意図した更新にはカタログバージョンと読み込み互換試験の更新を伴う旨をコメントに明記しました。
- 検証:
- `npm ci`: 成功。初期PATHのNode v26.8.1で実行しました。その後、以下の検査はNode v24.21.0をPATH先頭に設定して実行しました。
- `npm run typecheck`: 成功。
- `npm test`: 37ファイル、260テスト成功。
- `npm run build`: 成功。
- `npm run check:dist`: 成功。最初の実行はビルド完了前だったため`dist/index.html`未生成で失敗しましたが、ビルド完了後の再実行で成功しました。
- `(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`: 成功。
- `(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`: 8ファイル、34テスト成功。
- `node_modules/.bin/vitest run packages/editor-core/stitches/catalog.test.ts -t 'keeps every persisted stitch metadata field compatible with the fixed fixture'`: テストファイル内で実データを一時変更し、`yo`の`consumes: 9`、`produces: 8`、`category: cable`の場合と、`purl`の幅・高さを2にした場合の両方で、期待どおりfixture照合が失敗しました。カタログのソースは変更していません。一時変更は除去済みです。
- `node_modules/.bin/vitest run packages/editor-core/stitches/catalog.test.ts packages/editor-core/storage/database.test.ts`: 一時変更除去後、2ファイル、33テスト成功。
- `git diff --check`: 成功。
- 未実行: `npm run test:e2e`（Chromium/WebKit）はsandboxでブラウザ起動不可のため検証担当へ依頼します。iOSのXcodeGen、iPhone/iPad Simulator、app-update、unsigned Release Archive、offline bundle検査はPR CIへ任せます。テストのみの変更で画面写真は不要です。
- デプロイ影響: none。実行時コード・配信物に変更がなく、追加の配信後確認は不要です。
