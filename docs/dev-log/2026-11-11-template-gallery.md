# 2026-11-11 — 編み図テンプレートの配布ページを追加する

- 影響: `/templates/`を追加し、定番模様8種類（鹿の子編み、メリヤス編み、1目ゴム編み、2目ゴム編み、2/2ケーブル、ねじり目の列、北欧の小モチーフ、市松）の編み図を`.knit`で配布するようにした。ダウンロードしてエディタの「出力」→「バックアップから復元」で開くと、名前に「（復元）」が付いた編み図として追加される。各テンプレートにはプレビューSVG、段数・目数、使う記号、向く作品を載せた。テンプレートの`.knit`は`scripts/generate-templates.mjs`で作り、記号のIDと`.knit`の形式はアプリと同じ実装（`packages/editor-core`）を使う。スクリプトはTypeScriptを直接読み込むためにViteのSSR読み込みを使う。プレビューは記号カタログのSVGから作り、エディタと同じ記号で表示する。テンプレートは、どの段も20目を使い20目を作る（段の途中で目数が変わらない）ことをテストで確かめる。かけ目と2目一度を組み合わせた透かしは、この幅のままでは段ごとの目数が合わなかったため、テンプレートから外し、ねじり目の列に置き換えた。サイトマップ、`llms.txt`、配信物の検査、配信後の確認（`smoke`）に`/templates/`を加えた。`/templates/`でも、ほかの静的なページと同じ計測（`page_view`と`link_clicked`）を送る。編集画面へ進むリンクは`editor`、ダウンロードは`template_<名前>`（`template_seed`など）である。あわせて、#478で残っていた「静的なページは計測していない」という`docs/GA4_ANALYSIS.md`の記述を直した。
- 主なファイル: `scripts/generate-templates.mjs`（新規）、`public/templates/index.html`（新規）、`public/templates/*.knit`・`*.svg`（新規、8種類ずつ）、`public/sitemap.xml`、`public/llms.txt`、`scripts/check-dist.mjs`、`scripts/check-live-site.mjs`、`scripts/retain-previous-assets.test.mjs`（固定の応答に`/templates/`を追加）、`scripts/templates.test.mjs`（新規）、`tests/e2e/templates.spec.ts`（新規）、`scripts/static-page-analytics.test.mjs`、`docs/ANALYTICS.md`、`docs/GA4_ANALYSIS.md`
- テスト: `scripts/templates.test.mjs`で、8つの`.knit`が復号できて20段20目で開けること、模様の中身（すべて表目、表目と裏目の並び、交差の段、ねじり目の列、配色）と、どの段も20目を使い20目を作ることを確かめる。あわせて、公開ページが全テンプレートのプレビューとダウンロードを載せ、サイトマップと`llms.txt`から辿れることを確かめる。`tests/e2e/templates.spec.ts`で、一覧・プレビュー画像・ダウンロード・gzipの先頭バイト・エディタへの復元を確かめる。
- 検証:
  - `npm run typecheck`、`npm test`（1117件成功）、`npm run build`、`npm run check:dist`が成功した。
  - `npm run test:e2e`は654件成功、37件スキップ、2件失敗した。失敗はどちらも`tests/e2e/layout-focus-and-hover.spec.ts`の1280×1024・48pxで、#425で知られている操作メニューの位置のずれである。この変更は編集画面の配置に触れていない。失敗したファイルの再実行では、3つの構成の39件とも成功した。
  - 390×844と1280×900でページを表示し、プレビュー・カードの並び・ダークの配色を目で確かめた。
  - 2026-11-12: 編み物に詳しい人に8種類の図を見てもらい、模様として問題ないとの回答を得た。実際に編んだ編み地の確認ではない。
  - テンプレートの再生成は`node scripts/generate-templates.mjs`。CIでは実行しない。
- デプロイ影響: あり（Pagesへ配信される）。配信後に`https://knittingeditor.com/templates/`を開き、8種類のプレビューが出ること、`.knit`をダウンロードして「バックアップから復元」で開けることを確かめる。`smoke`が`/templates/`のHTMLを確認する。
