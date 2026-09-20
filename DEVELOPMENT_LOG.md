# Development Log

## 2026-09-20 — 編み目記号の互換性・PDF白塗り・選択UIを改善

- 影響: 保存済み編み図で使う記号IDを明示的な永続値に変更し、バックアップへ記号カタログ版を記録するようにした。旧キー `purl_twisst_stitch` は互換名として読込みを維持する。「白くする」は消去とは別の記号として残し、PDFでもセルを白く塗ってグリッドを隠すよう修正した。従来の文字だけの選択欄を、記号画像・名称・占有目数を分類表示するパレットへ変更した。記号図形そのものは変更していない。
- 主なファイル: `src/stitches/catalog.ts`, `src/stitches/svgMarkup.js`, `src/App.tsx`, `src/styles.css`, `src/export/pdf.worker.ts`, `src/storage/database.ts`
- テスト: `src/stitches/catalog.test.ts` に永続ID、キー重複、全SVG、旧キー互換の検証を追加した。`src/export/pdf.worker.test.ts` にPDF白塗り命令、`src/storage/database.test.ts` にバックアップの記号カタログ版、`tests/e2e/editor.spec.ts` に記号パレット表示・選択・ID 25の保存を追加した。
- 検証: `npm run typecheck`、`npm test`（17件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を実行し、すべて成功。ChromiumとWebKitでモバイル390×844、デスクトップ1280×800のパレットを手動確認し、スクリーンショットを `/tmp/stitch-picker-{chromium,webkit}-{mobile,desktop}.png` に保存した。
- デプロイ影響: 2026-09-20にコミット `58250b2` までを `main` へデプロイした。GitHub Actions「Test and deploy Pages」run `35479673129` のテスト・ビルド・デプロイはすべて成功。本番 `https://knittingeditor.com/`（HTTP 200）で25記号のパレット表示、「白くする」のID 25での保存と再読込み、PDF生成、およびPDF内の白塗り命令を確認した。

## 2026-09-20 — SEOと使い方ページのブラウザテストを追加

- 影響: 実行時の動作は変更しない。`/` のメタデータ、構造化データ、JavaScript実行前の説明文、`/guide/` ページ、sitemapとfaviconの配信を自動検証するようにした。
- 主なファイル: `tests/e2e/seo.spec.ts`
- テスト: Playwrightに7件のテストを追加した。JavaScript実行前のHTML（`page.request.get('/')`）、title・canonical・OGP・Twitter Card・favicon、`WebSite` と `WebApplication` のJSON-LD、React描画後にフォールバックの `h1` が重複しないこと、ヘッダーの「使い方」からの遷移、`/guide/` への直接アクセスとそのメタデータ、sitemapとfaviconの配信を確認する。追加したテストはindex.htmlのtitleとフォールバックのリンクを削除し `public/guide/` を退避した状態で実際に失敗することを確認済み。
- 検証: `npm run typecheck`、`npm test`（13件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、36件）を実行し、すべて成功。
- デプロイ影響: なし。テストのみの追加で `dist/` の生成物は変わらない。

## 2026-09-20 — 検索流入向けのメタデータと使い方ページを追加

- 影響: トップページの `title` と description を検索意図に合わせ、Open Graph / Twitter Card と `WebSite`・`WebApplication` の構造化データを追加した。JavaScript実行前のHTMLに主要な説明とガイドへのリンクを含め、静的な使い方ページ `/guide/` とfaviconを追加し、エディタのヘッダーに「使い方」への導線を置いた。sitemapに `/guide/` を追加し、`check:dist` でSEO関連ファイルの存在も検査するようにした。エディタの機能と保存形式は変更していない。
- 主なファイル: `index.html`, `public/guide/index.html`, `public/favicon.svg`, `public/sitemap.xml`, `scripts/check-dist.mjs`, `src/App.tsx`, `src/styles.css`
- テスト: このコミット自体には自動テストを追加していない。レビューでSEO面とガイドページのブラウザ検証が不足していると指摘されたため、`tests/e2e/seo.spec.ts` を別コミットで追加した。
- 検証: PR #4 のCI（run `35453463106`）と、マージ後の `main`（コミット `8388cf49`、run `35476210888`）で `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e` がすべて成功した。ローカルでの個別実行は行っていない。
- デプロイ影響: 2026-09-20にコミット `8388cf49` を含む `main` をデプロイした。GitHub Actions「Test and deploy Pages」run `35476210888` のテスト・ビルド・デプロイはすべて成功。本番 `https://knittingeditor.com/` で新しい `title`、JSON-LD、JavaScript実行前の `h1` とガイドへのリンク、`/guide/` の直接表示（HTTP 200）、`/favicon.svg` の配信（`image/svg+xml`）、sitemapへの2URL掲載を確認した。ブラウザでヘッダーの「使い方」から `/guide/` へ遷移することも確認済み。Search Consoleでの `/guide/` のインデックス登録は後日確認する。

## 2026-09-19 — 編集から出力までの利用分析を追加

- 影響: GA4でエディタ準備、初回編集、機能パネル、編み目選択、新規作成、ブロック利用、PNG/PDF出力、バックアップ、処理失敗を分析できるようにした。編み図名・ファイル名・文書IDは送信せず、自動テストでは計測を無効化する。表示と操作手順は変更しない。
- 主なファイル: `src/analytics.ts`, `src/analytics.test.ts`, `src/main.tsx`, `src/App.tsx`
- GA4設定: Search Consoleを連携し、イベントデータ保持を14か月に変更した。8個のイベントスコープ カスタムディメンションを登録済み。`chart_exported` のキーイベント化は初回の本番イベント受信後に行う。
- テスト: `src/analytics.test.ts` に本番限定の初期化、重複防止、イベント送信、初回編集の一度だけの送信、低カーディナリティ区分のテストを追加した。
- 検証: `npm run typecheck`、`npm test`（13件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 2026-09-19にコミット `7e5ee7e` を含む `main` をデプロイした。GitHub Actions「Test and deploy Pages」run `35448658273` のテスト・ビルド・デプロイはすべて成功。本番 `https://knittingeditor.com/` で生成物 `index-D3vfZDcQ.js` の配信、エディタ起動、保存パネル表示、PNG保存操作に画面上のエラーがないことを確認した。自動操作は計測対象外のため、GA4のイベント受信と `chart_exported` のキーイベント化は通常利用者の初回イベント受信後に確認する。

## 2026-09-19 — 盤外からの無効な範囲選択を防止

- 影響: 行列ラベルなど盤外から範囲選択を開始しても、0行・0列の不正なブロックを作成しないようにした。盤内での範囲選択動作は変更しない。
- 主なファイル: `src/model/Board.ts`, `src/canvas/BoardCanvas.tsx`
- テスト: `src/model/Board.test.ts` に盤外選択の境界テストを追加した。
- 検証: `npm run typecheck`、`npm test`（9件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 静的アプリの更新あり。デプロイ後に盤内の範囲選択とブロック作成を確認する必要がある。

## 2026-09-19 — 自動保存の競合を修正

- 影響: 保存処理中に追加された編集を未保存扱いに戻さず、別の編み図へ切り替えた後に古い保存結果で表示を戻さないようにした。
- 主なファイル: `src/App.tsx`
- テスト: `tests/e2e/editor.spec.ts` の永続化確認を実セル内容まで強化した。
- 検証: `npm run typecheck`、`npm test`（9件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 静的アプリの更新あり。デプロイ後に編集・自動保存・再読込みを確認する必要がある。
