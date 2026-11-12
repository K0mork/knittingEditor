# 2026-11-12 — 編み図の作り方のページを追加する

- 影響: `/chart-basics/`を追加し、編み図を描き始める前に知りたいことを1ページにまとめた。内容は、編み図を描く手段（方眼紙・表計算ソフト・編み図用のアプリ・このサイト）の向き不向き、ゲージから段数と目数を決める手順と計算例、A4に分割して印刷するときの設定と注意、記号の向き・裏側から見た段・目数が合わない・色の見え方のつまずきである。`/guide/`は操作手順、このページは考え方として役割を分け、使い方からは「編み図の作り方」へ、このページからは「使い方」へ相互にリンクした。トップページ（JavaScriptで描き替える前のHTML）・編み目記号の一覧・テンプレートからもリンクした。サイトマップ、`llms.txt`、配信物の検査（`check-dist`）、配信後の確認（`smoke`）、計測の対象ページとプライバシーポリシーに`/chart-basics/`を加えた。ページは`public/chart-basics/index.html`に静的に置き、ほかのページと同じ計測（`page_view`と`link_clicked`の`editor`）を送る。記事を分けず、1ページに集約した。
- 主なファイル: `public/chart-basics/index.html`（新規）、`scripts/chart-basics-page.test.mjs`（新規）、`tests/e2e/chart-basics.spec.ts`（新規）、`public/sitemap.xml`、`public/llms.txt`、`index.html`、`public/guide/index.html`、`scripts/generate-stitch-page.mjs`（記号の一覧からのリンク）と`public/stitches/index.html`（再生成）、`scripts/check-dist.mjs`、`scripts/check-live-site.mjs`、`scripts/retain-previous-assets.test.mjs`、`scripts/static-page-analytics.test.mjs`、`public/privacy/index.html`、`docs/ANALYTICS.md`、`docs/GA4_ANALYSIS.md`、`tests/e2e/csp.spec.ts`、`tests/e2e/contrast.spec.ts`、`tests/e2e/seo.spec.ts`
- テスト: `scripts/chart-basics-page.test.mjs`で、タイトル・canonical・OGP、5つの見出し、4つの手段の比較、ゲージの計算例（20×50÷10=100目、28×30÷10=84段）、分割PDFの設定、使い方・記号の一覧・テンプレートとの相互リンク、サイトマップと`llms.txt`、計測のスクリプトと`data-analytics`を確かめる。`tests/e2e/chart-basics.spec.ts`で、直接開いて再読み込みできること、4つのカードと見出し、編集画面への遷移、使い方との相互リンク、幅360pxで横にスクロールしないことを確かめる。`tests/e2e/csp.spec.ts`・`tests/e2e/contrast.spec.ts`・`tests/e2e/seo.spec.ts`のページ一覧に`/chart-basics/`を足した。
- 検証:
  - `npm run typecheck`、`npm test`（1156件成功）、`npm run build`、`npm run check:dist`が成功した。
  - `npx playwright test tests/e2e/chart-basics.spec.ts tests/e2e/stitches.spec.ts tests/e2e/csp.spec.ts`（57件成功）が成功した。
  - 390×844と1280×900、ライトとダークで表示し、手段の比較が2列（スマートフォンは1列）で並ぶこと、横幅からのはみ出しがないことを目で確かめた。確認画像は`/tmp/chart-basics-*.png`に保存した。
  - 分割PDFの説明（1段・1列の重なり、ページ下端の「2/6ページ 段21〜40 目1〜30」、推定ページ数、セル寸法2〜10mm）は、`packages/editor-core/export/pdfLayout.ts`と`pdf.worker.ts`、出力パネルの表示で確かめた。
  - `npm run test:e2e`は685件成功、37件スキップ、1件失敗した。失敗は`tests/e2e/layout-focus-and-hover.spec.ts`の1024×1024・28pxで、#425で知られている操作メニューの位置のずれである。この変更は編集画面の配置に触れていない。失敗したファイルの再実行では3つの構成の39件とも成功した。
  - ゲージの計算例と段数・目数の決め方は、編み物の知識がある人に内容を確認してもらう（#469の完了条件）。実際に編んだ編み地での確認はしていない。
- デプロイ影響: あり（Pagesへ配信される）。配信後に`https://knittingeditor.com/chart-basics/`を直接開いて再読み込みし、内容と編集画面へのリンク、使い方との相互リンクを確かめる。`smoke`は`/chart-basics/`のHTMLを配信物と比べる。
