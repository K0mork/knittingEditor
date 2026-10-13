# 2026-10-12 — PNG・PDFに編み図名と使用記号の一覧を任意で付ける

- 影響: Closes #217。既定オフの「編み図名と記号の一覧を入れる」を保存パネルに追加。オンならPNG・1ページPDFでは上に編み図名、盤面の下に使用記号の図と名前を載せる。分割PDFでは盤面各ページの上余白に編み図名を載せ、凡例を末尾の専用ページにまとめる。盤面の位置・分割・ページ数はオフ時と同じ。現在の全25記号は凡例1ページに収まり、使用記号がある場合だけ全体のページ数はオフ時+1。空盤面と「白くする」だけの盤面には凡例ページを追加しない。収まらない場合だけ凡例ページを追加する。空白の注記や編み方の説明は追加しない。「白くする」は凡例から除外する。分割PDFのページ・段・目は両モードで日本語表記。分割盤面の題名は最大9pt、基線を上端から18ptに置き、印刷余白を確保する。凡例ページにも段・目の範囲を含まないページ番号を同じ位置に付ける。オフのPNGと1ページPDFは従来どおり。
- 主なファイル: `packages/editor-core/export/annotations.ts`、`exporters.ts`、`pdf.worker.ts`、`pdfLayout.ts`、`packages/editor-core/ui/ExportControls.tsx`、`useEditorController.ts`。PDFのCMapを `/UniJIS-UCS2-HW-H`、ASCII用CID幅を `/W [231 325 500]` に変更し、文字幅の計算と一致させる。凡例のPDFセルは12pt、縦3列・横4列。行高は通常20pt、2段の記号を含む行だけ32pt。使用記号の高さを保存パネルから渡し、見積もりとWorkerのページ配置を同じ計算で求める。PNGは最低20pxの枠付き記号を使い、小さい盤面を中央配置する。
- テスト: 新規 `packages/editor-core/export/exportAnnotations.test.ts`（17件）、`packages/editor-core/ui/ExportControls.annotations.test.tsx`、`tests/e2e/export-title-and-legend.spec.ts`。使用記号の選択、オフ時の描画一致、フォント辞書、名前と枠の中央配置、日本語範囲、縦横の見積もりと実ページ数、分割タイルの一致、凡例が一度だけ出ること、列数・可変行高・凡例の複数ページ対応、題名の9pt・18pt位置、凡例フッター、空盤面と白塗りのみの縦横・3/5/10mmでオン＝オフのページ数を検証。E2Eには表示の見積もりとダウンロードしたPDFのページ数一致、使用記号があるオン時の分割ページ数がオフ時+1になる検証と、空盤面ではオン＝オフになる検証を追加。
- 検証: Node 24で以下を実行。
  - `npm run typecheck`：成功。
  - `npm test`：47ファイル、455件成功。
  - `npm run build`：成功。
  - `npm run check:dist`：成功。`dist/CNAME` は `knittingeditor.com`。
  - `(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`：成功。
  - `(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`：11ファイル、102件成功。
  - `git diff --check`：成功。
  - 最終修正前の確認: `npx playwright test tests/e2e/export-title-and-legend.spec.ts --repeat-each 2` は6/6成功。`npm run test:e2e` は267件成功、6件スキップ、0件失敗。
  - 最終修正前のオフ時比較: 分岐元 `c74049e` と9盤面を比較。1ページPDFはバイト一致、分割PDFは日本語フッターとフォント以外のストリーム・用紙・分割が一致（計108条件、差分0）。PNGはChromium・WebKit各216条件を比較。Chromiumは差分0、WebKitの一時差1件は同条件4回の再実行で旧版・新版とも一致した。
  - 最終修正前の描画: pdf.js 4.10.38（Chromium、cMap指定）、macOSの `sips`・`qlmanage` で英数字の字間、凡例の枠・名前・6目交差・2段すべり目、盤面との非重複を確認。保存パネルは390×844と1440×900、PNGはChromium・WebKitのセル2/24/60pxで確認した。
  - 今回の題名位置・空凡例・凡例フッター修正後は上記ローカル6コマンドと `git diff --check` を再実行して成功。修正後に`npx playwright test tests/e2e/export-title-and-legend.spec.ts --repeat-each 2`（3構成で12件成功）と`npm run test:e2e`（270件成功、6件スキップ、失敗0件）を実行した。題名の位置は単体テストで確かめ、修正後のPDFの目視はしていない。iOSビルド・iPhone/iPad Simulator・更新復元・Release Archive・オフラインバンドル検査はPR CIで確認する。
- デプロイ影響: マージ後にPagesとiOS同梱Webへ反映。未配信。公開後は設定の有無でPNG・1ページPDF・分割PDFを保存し、macOS/iOSを含む英数字の字間、凡例の判別、盤面・番号・題名の非重複、末尾の凡例ページと見積もりの一致を確認する。
