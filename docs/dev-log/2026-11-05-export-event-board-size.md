# 2026-11-05 — 出力イベントの盤面サイズを、出力を始めた時点の盤面で記録する

- 影響: `chart_exported`の`board_size_bucket`は、PNG/PDFの生成と保存・共有の受け渡しを待ったあとに、その時点の盤面の寸法から計算していた。`Board.resize`は盤面をその場で書き換え、出力中の処理中表示は盤面の操作を止めない。このため、出力中に盤面パネルでサイズを変えると、出力したのは変更前の盤面なのに、イベントには変更後のサイズが記録された（#412）。出力を始めた時点で区分を計算して固定し、その値を記録するようにした。`export_state`・`progress_bucket`・`chart_origin`は、もともと開始時に取得している。`pdf_layout`などほかのパラメータと、出力されるPNG/PDFの内容は変えていない。`docs/ANALYTICS.md`の`chart_exported`の行に、出力を始めた時点の盤面であることを書き足した。
- 主なファイル: `packages/editor-core/ui/useEditorController.ts`、`docs/ANALYTICS.md`
- テスト: `packages/editor-core/ui/useEditorController.test.tsx`に、PNGとPDFのそれぞれについて、描画の完了を待っている間に盤面を4×4から120×120へ変え、`chart_exported`の`board_size_bucket`が開始時の`small`のままであることを確かめるテストを足した。PDFでは`pdf_layout`が`tiled`のまま記録されることも確かめる。修正前のコードでは、2件とも`xlarge`が記録されて失敗することを確かめた。
- 検証:
  - `npx vitest run packages/editor-core/ui/useEditorController.test.tsx`：39件すべて成功した。
  - `npm ci`をしたworktreeで、全体の検査を実行した。
    - `npm run typecheck`、`npm test`（1054件）、`npm run build`、`npm run check:dist`：成功した。
    - `npm run test:e2e`：624件成功、36件スキップ、失敗なし。
  - iOS Web（`ios/Web`）：`tsc -p tsconfig.app.json --noEmit`と`vitest run --config vite.config.ts`（151件）が成功した。
  - Simulatorのテストは手元で実行していない。Swiftとアプリの設定には触れていないので、PRのCIの`ios`ジョブと、マージ後のFull iOS validationに任せる。
- デプロイ影響: Pagesへ配信される。iOSアプリにも次のビルドから入る。画面の見た目と出力されるファイルは変わらず、分析イベントの値だけが変わる。配信後に確かめることはない。
