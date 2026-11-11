# 2026-11-11 — 編み図テンプレートの配布ページを追加する

- 影響: `/templates/`を追加し、定番模様8種類（鹿の子編み、メリヤス編み、1目ゴム編み、2目ゴム編み、2/2ケーブル、透かし、北欧の小モチーフ、市松）の編み図を`.knit`で配布するようにした。ダウンロードしてエディタの「出力」→「バックアップから復元」で開くと、名前に「（復元）」が付いた編み図として追加される。各テンプレートにはプレビューSVG、段数・目数、使う記号、向く作品を載せた。テンプレートの`.knit`は`scripts/generate-templates.mjs`で作り、記号のIDと`.knit`の形式はアプリと同じ実装（`packages/editor-core`）を使う。スクリプトはTypeScriptを直接読み込むためにViteのSSR読み込みを使う。プレビューは記号カタログのSVGから作り、エディタと同じ記号で表示する。サイトマップ、`llms.txt`、配信物の検査、配信後の確認（`smoke`）に`/templates/`を加えた。`/templates/`でも、ほかの静的なページと同じ計測（`page_view`と`link_clicked`）を送る。編集画面へ進むリンクは`editor`、ダウンロードは`template_<名前>`（`template_seed`など）である。あわせて、#478で残っていた「静的なページは計測していない」という`docs/GA4_ANALYSIS.md`の記述を直した。
- 主なファイル: `scripts/generate-templates.mjs`（新規）、`public/templates/index.html`（新規）、`public/templates/*.knit`・`*.svg`（新規、8種類ずつ）、`public/sitemap.xml`、`public/llms.txt`、`scripts/check-dist.mjs`、`scripts/check-live-site.mjs`、`scripts/retain-previous-assets.test.mjs`（固定の応答に`/templates/`を追加）、`scripts/templates.test.mjs`（新規）、`tests/e2e/templates.spec.ts`（新規）、`scripts/static-page-analytics.test.mjs`、`docs/ANALYTICS.md`、`docs/GA4_ANALYSIS.md`
- テスト: `scripts/templates.test.mjs`で、8つの`.knit`が復号できて20段20目で開けること、模様の中身（すべて表目、表目と裏目の並び、交差の段、かけ目と2目一度、配色）を確かめる。あわせて、公開ページが全テンプレートのプレビューとダウンロードを載せ、サイトマップと`llms.txt`から辿れることを確かめる。`tests/e2e/templates.spec.ts`で、一覧・プレビュー画像・ダウンロード・gzipの先頭バイト・エディタへの復元を確かめる。
- 検証:
  - `npm run typecheck`、`npm test`（1117件成功）、`npm run build`、`npm run check:dist`が成功した。
  - `npm run test:e2e`は655件成功、37件スキップ、1件失敗した。失敗は`tests/e2e/layout-focus-and-hover.spec.ts`の1280×1024・48pxの1件で、#425で知られている操作メニューの位置のずれである。この変更は編集画面の配置に触れていない。失敗したファイルの再実行では13件とも成功した。
  - 390×844と1280×900でページを表示し、プレビュー・カードの並び・ダークの配色を目で確かめた。
  - テンプレートの再生成は`node scripts/generate-templates.mjs`。CIでは実行しない。
- デプロイ影響: あり（Pagesへ配信される）。配信後に`https://knittingeditor.com/templates/`を開き、8種類のプレビューが出ること、`.knit`をダウンロードして「バックアップから復元」で開けることを確かめる。`smoke`が`/templates/`のHTMLを確認する。
