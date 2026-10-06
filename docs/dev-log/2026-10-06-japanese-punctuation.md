# 2026-10-06 — 利用者に見せる文章の句読点を「、」「。」にそろえる

- 影響: Web版の使い方ページ、アプリ内の使い方ページ、`/third-party-notices/`の導入文で使っていた全角の「，」「．」を、一般的な「、」「。」に変えた。同じページの中でも混在していたため（#105）。見出しの番号の「1．」は句点ではないので、半角の「1. 」にした。今後入らないよう、利用者に見せる文章のソースに「，」「．」があると失敗するテストを足した。
- 主なファイル: `public/guide/index.html`、`ios/Web/public/guide/index.html`、`scripts/third-party-notices.mjs`、`scripts/japanese-punctuation.test.mjs`
- テスト: `scripts/japanese-punctuation.test.mjs`を追加した。`index.html`、`public/`、`src/`、`packages/`、`scripts/third-party-notices.mjs`、`ios/Web/`の`index.html`・`public/`・`src/`、`ios/App/`、`ios/docs/APP_STORE_METADATA.md`を走査し、「，」「．」がある行を`ファイル:行`で示して失敗する。使い方ページに「，」を足すと失敗し、該当行を示すことを手元で確かめた。
- 検証: `npm run typecheck`、`npm test`（142件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（chromium-desktop、chromium-mobile、webkit-mobileで91件成功、既存の2件はスキップ）、iOS Webの型検査（`tsc -p tsconfig.app.json --noEmit`）とテスト（`vitest run --config vite.config.ts`、8件）はすべて成功。手元のNode.jsは26で、指定の24ではない。ビルドした`dist/guide/index.html`と`ios/Web/public/guide/index.html`を幅375pxと幅800pxで表示し、横にはみ出さず、本文に「，」「．」が無いことを確かめた。iOSのSimulatorの検査とアプリのビルドはPRのCIに任せた（Swiftとビルド設定は変えていない）。
- デプロイ影響: Pagesへ使い方ページと`/third-party-notices/`の文言の変更が配信される。配信後に`https://knittingeditor.com/guide/`の見出しと本文の句読点を確かめる。
