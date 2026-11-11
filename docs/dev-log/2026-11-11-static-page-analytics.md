# 2026-11-11 — 使い方・サポート・プライバシーポリシーのページで閲覧とリンクのクリックを計測する

- 影響: 静的な公開ページ（`/guide/`、`/support/`、`/privacy/`）で、GA4へページの閲覧（`page_view`）と、`data-analytics`を付けたリンクのクリック（`link_clicked`、`link_name`は`editor`と`app_store`）を送るようにした。これまで計測は編集画面だけで、検索から静的なページに着地した人の流れを見られなかった（#465）。送るのは本番のドメイン`knittingeditor.com`のページだけで、`navigator.webdriver`、User-Agentの`Claude/`、`knitting-editor:analytics-opt-out`は編集画面と同じように除外する。CSPがインラインのスクリプトを止めるため、`public/analytics.js`を外部スクリプトとして読み込み、`data-analytics-entry`を付けたタグから開始する。測定IDと停止キーは`src/analytics.ts`と同じ値を使い、テストで一致を確かめる。iOS版の使い方ページ（`ios/Web/public/guide/index.html`）には入れない（アプリはアクセス解析を送らない）。プライバシーポリシーの「編集画面以外のページでは使っていません」という記述を、各ページで使うことと`link_clicked`の内容に合わせて直した。
- 主なファイル: `public/analytics.js`（新規）、`public/guide/index.html`、`public/support/index.html`、`public/privacy/index.html`、`src/analytics.ts`（測定IDと停止キーをexport）、`scripts/check-dist.mjs`（`analytics.js`を配信物の必須ファイルに追加）、`docs/ANALYTICS.md`、`docs/GA4_ANALYSIS.md`
- テスト: `src/staticPageAnalytics.test.ts`を足した。測定IDと停止キーが編集画面と一致すること、送信の条件（本番のドメイン・`webdriver`・`Claude/`・オプトアウト）、`start()`が`config`と`link_clicked`を送ることを確かめる。`scripts/static-page-analytics.test.mjs`を足した。3ページがスクリプトを1回だけ読み込むこと、`data-analytics`の付き方、編集画面とiOS版の使い方ページが読み込まないことを確かめる。
- 検証:
  - `npm run typecheck`、`npm test`（1102件成功）、`npm run build`、`npm run check:dist`が成功した。`dist/guide/index.html`などにスクリプトとCSPのmetaがあり、`dist/analytics.js`が配信物にあることを確かめた。
  - 1回目の`npm run test:e2e`は647件中645件成功、37件スキップ、2件失敗した。失敗は`tests/e2e/layout-focus-and-hover.spec.ts`の「keeps selection and action controls separate」（390x844と1024x1024）で、範囲選択を解除したあとの操作メニューの位置がずれる#425と同じ箇所だった。この変更は編集画面の配置に触れていない。
  - 失敗した2件は`npx playwright test tests/e2e/layout-focus-and-hover.spec.ts --project=chromium-mobile`の再実行で13件とも成功した。そのうえで`npm run test:e2e`をもう一度実行し、647件成功・37件スキップ・失敗0件だった。
  - 本番での`page_view`と`link_clicked`の受信は、配信後にGA4 Realtimeで確かめる（#465の完了条件）。
- デプロイ影響: あり（Pagesへ配信される）。配信後、`https://knittingeditor.com/guide/`を開き、`page_view`と、編集画面へ進むリンクの`link_clicked`がGA4 Realtimeに届くことを確かめる。`/support/`と`/privacy/`も同じ。
