# 2026-11-19 — 使い方からテンプレートへのリンクと、全テンプレートの出力E2E

- 影響: `/guide/`（使い方）の冒頭とフッターから`/templates/`（編み図テンプレート）へ内部リンクを張った。文言は`/chart-basics/`・`/stitches/`と同じ「すぐに使える模様は…テンプレートにまとめています」で、静的なページ間の移動なので`data-analytics`は付けない。編集画面（`/`）へのリンクの置き場所は利用者が決めておらず、#467の完了条件にも含まれないため入れず、issueへ残す。iOS版の使い方には、Web版だけのページであるテンプレートへのリンクを置かない。
- 主なファイル: `public/guide/index.html`、`tests/e2e/templates.spec.ts`、`scripts/templates.test.mjs`
- テスト: `scripts/templates.test.mjs`で、使い方と記号一覧の両方から`/templates/`へリンクしていること、iOS版の使い方にはリンクしていないことを確かめる。`tests/e2e/templates.spec.ts`では、全8種の`.knit`を1つのテストで順に復元・書き出ししていたのを、テンプレートごとに1本のテストに分けた（タイムアウトは既定のまま）。各テストはその`.knit`を「バックアップから復元」で開き、編み図名（「（復元）」付き）と20段20目の盤面を確かめ（復元の待ちは既存の復元テストと同じ60秒）、出力パネルを開いてPNGの署名と寸法（パネルに表示した寸法と実際のPNGの寸法の一致。寸法は記号の一覧を入れると使った記号で変わるため、テンプレート間で同じであること自体は保証しない）、PDFの署名と盤面の描画命令（`pdfStreams`で全ストリームを展開して確かめる）を確かめる。ダウンロードは`downloadInsteadOfShare`で実際のダウンロードとして受け取る。
- 検証: Node.js v26.8.1で`npm run typecheck`、`npm test`（1180件成功）、`npm run build`、`npm run check:dist`（`dist verified: 3170.7 KiB`）、`npx playwright test tests/e2e/templates.spec.ts --list`（3構成で33件）が成功した。Playwright E2E（`npm run test:e2e`、Chromiumモバイル・デスクトップとWebKitモバイルの3構成）とiOS Simulator・Xcodeの検証はこの環境で実行できないため、リーダーが実行する。
- デプロイ影響: あり（Pagesへ配信される）。配信後に`https://knittingeditor.com/guide/`を開き、冒頭とフッターのリンクから`/templates/`へ移動できることを確かめる。`smoke`は`/guide/`のHTMLを配信物と比べる。
