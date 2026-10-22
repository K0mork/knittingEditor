# 2026-10-22 — 「線」の点線を太く、矢印を大きくする

- 影響: 「線」ツールで引く点線が細く、矢印も小さくて見えにくかった。線の太さを編み目記号の線と同じマスの9%（これまで4.5%）、点の長さとすき間を14%・10%（これまで9%・10%）、矢印を長さ46%・幅52%（これまで18%・約20%）にした。盤面、PNG、PDF（盤面と一覧）は、`GUIDE_LINE_SHAPE`の同じ比率で描く。保存形式は変わらない。
- 主なファイル: `packages/editor-core/canvas/guideLines.ts`、`packages/editor-core/export/pdf.worker.ts`。
- テスト:
  - `packages/editor-core/export/exporters.test.ts`：PNGの点線の太さ・点の長さとすき間・矢印の長さと幅を、マスに対する比率で確かめるようにした。
  - `packages/editor-core/export/pdf.worker.test.ts`：PDFの点線と矢印の命令が同じ比率になることを確かめるテストを追加した。
- 検証:
  - Node v26.8.1（CI指定はNode 24）で、`npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop）がすべて成功した（Vitest 783件、Playwright 524件成功・7件スキップ）。
  - 一時的なPlaywrightのテストで、モバイルとデスクトップの盤面に記号と線を描いた画面写真を撮り、点線と矢印の大きさを目で確かめた（写真はコミットしない）。
  - iPhone・iPadはPRのCIと`ios-full.yml`で確かめる。
- デプロイ影響: Pagesへ配信される。配信後に本番で線を引き、盤面とPNG・PDFの点線と矢印が太く大きくなっていることを確かめる。
