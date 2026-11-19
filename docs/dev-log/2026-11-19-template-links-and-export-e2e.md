# 2026-11-19 — 使い方からテンプレートへのリンクと、全テンプレートの出力E2E

- 影響: `/guide/`（使い方）の冒頭とフッターから`/templates/`（編み図テンプレート）へ内部リンクを張った。文言は`/chart-basics/`・`/stitches/`と同じ「すぐに使える模様は…テンプレートにまとめています」で、静的なページ間の移動なので`data-analytics`は付けない。編集画面（`/`）へのリンクの置き場所は利用者が決めておらず、#467の完了条件にも含まれないため入れず、issueへ残す。iOS版の使い方には、Web版だけのページであるテンプレートへのリンクを置かない。
- 主なファイル: `public/guide/index.html`、`tests/e2e/templates.spec.ts`、`scripts/templates.test.mjs`
- テスト: `tests/e2e/templates.spec.ts`に、8種類のテンプレートごとのテストを足した。各テストはその`.knit`を「バックアップから復元」で開いて編み図名（「（復元）」付き）と20段20目の盤面を確かめ、出力パネルを開いてPNGの署名と寸法（パネルに表示した寸法と一致）、PDFの署名と盤面の描画命令（`pdfStreams`で全ストリームを展開して確かめる）を確かめる。`scripts/templates.test.mjs`では、使い方と記号一覧の両方から`/templates/`へリンクしていることを確かめる。
- 検証:
  - `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`が成功した。
  - `npm run test:e2e`（Chromiumモバイル・デスクトップ、WebKitモバイル）で、この変更で追加・更新したテストはすべて成功し、全体では712件が成功した。失敗は既知の間欠的な`layout-focus-and-hover.spec.ts`の比較（#425）だけで、これは別のPRで直している。
- デプロイ影響: あり（Pagesへ配信される）。配信後に`https://knittingeditor.com/guide/`を開き、冒頭とフッターのリンクから`/templates/`へ移動できることを確かめる。`smoke`は`/guide/`のHTMLを配信物と比べる。
