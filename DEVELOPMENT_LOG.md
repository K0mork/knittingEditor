# Development Log

## 2026-09-20 — ねじり目系4記号を正しいループ形へ修正

- 影響: ねじり目とねじり裏目がΩ状に見え、左右のねじり目交差が中央に独立した円を置いた形になっていた問題を修正した。単体は下部で交差して左右へ伸びるループ形、ねじり裏目は同形に裏目線を加えた形とした。交差は上側の斜めストランド自体にねじりループを組み込み、下側の裏目線と左右方向を公式凡例に合わせた。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 単体ねじり目の始終点と交差ループ、左右のねじり目交差が楕円部品を使わず曲線ストランドで構成されることを検証する回帰テストを追加・更新した。
- 検証: `npm run typecheck`、`npm test`（26件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。JIS L 0201のねじり目とクロバー公式編み図の「ねじり目の左上交差」「ねじり目の右上交差」を画像で照合し、ローカルの記号パレットで4記号を目視確認した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 交差記号の右上・左上方向を修正

- 影響: 交差記号で上を通る線の左右が名称と逆になっていた問題を修正した。右上は右下から左上へ進む線、左上は左下から右上へ進む線を途切れず上に描画する。単純交差、裏目交差、2×1交差、2目・3目交差、ねじり目交差の全左右ペアへ反映し、2×1交差は上を通る線束の本数も修正した。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 交差5組について上を通る線の方向と本数を、ねじり目交差について上側の接続方向を左右別に検証する回帰テストを追加した。
- 検証: `npm run typecheck`、`npm test`（25件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。JIS L 0201の右上・左上交差とクロバー公式編み図の右上・左上2目交差、2目と1目の交差、表目2目・裏目1目の交差を画像で照合した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 左右上3目一度の重複線を修正

- 影響: 右上3目一度と左上3目一度で、長い斜線と同方向の短い斜線が重なって二重に見えていた問題を修正した。両記号を縦線、反対側の短い斜線、長い斜線の3本で描画する。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 左右上3目一度がそれぞれ3本の独立した線で構成されることを追加した。
- 検証: `npm run typecheck`、`npm test`（23件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。ローカル盤面で左右の長い斜線が二重にならないことを画像確認した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 複数マス記号を占有領域全体へ描画

- 影響: 盤面上の占有判定だけが複数マスで図形は1マスに留まっていた不一致を修正した。右上・左上2目一度は横2マス、3目一度は横3マス、すべり目は縦2マスへ図形自体を拡張し、既に複数マスだった交差記号を含め、全記号の描画領域を占有領域と一致させた。画面・PNG・PDFへ共通して反映される。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.test.ts`
- テスト: 全ベクター記号の描画幅・高さがカタログ上の占有幅・高さと一致することを検証する回帰テストへ変更した。
- 検証: `npm run typecheck`、`npm test`（22件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。ローカル盤面で2目一度、3目一度、すべり目がそれぞれ2・3・2マスへ描画されることを画像確認した。
- デプロイ影響: なし。ローカルプレビューのみ。

## 2026-09-20 — 編み目記号を共通ベクター定義へ変更

- 影響: 25項目の記号を画面・PNG・PDFで共有するベクター定義へ置き換え、PDFの128px画像引き伸ばしを廃止した。既存データとの互換性を保つため、減目・すべり目を含む盤面上の占有マス数と永続IDは従来値を維持した。複数目の交差は扇状に広がらない平行な線束として、ねじり目交差は線が途切れない形として描き直した。パレットには規格名や区分を表示せず、記号名と占有目数だけを示す。
- 主なファイル: `src/stitches/glyphs.ts`, `src/stitches/catalog.ts`, `src/canvas/BoardCanvas.tsx`, `src/export/exporters.ts`, `src/export/pdf.worker.ts`, `src/App.tsx`, `src/styles.css`
- テスト: 永続ID、既存の盤面占有、記号の論理座標、全制御点が描画領域内にあること、SVG/PDFの有限なベクター出力、PDFから画像マスクがなくなったことを追加・更新した。
- 検証: `npm run typecheck`、`npm test`（22件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、39件）を順に実行し、すべて成功。ローカルの一覧ページで全25項目をパレット寸法と盤面実寸の双方で画像確認し、実際の記号パレットもデスクトップ幅で確認した。
- デプロイ影響: なし。ユーザー確認用のローカルプレビューのみ。承認後にデプロイする場合は、GitHub Actionsのテスト・デプロイ成功と本番の記号パレット、盤面、PNG/PDF出力を確認する必要がある。

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
