# 2026-11-12 — PDFの縞と罫線をPNGに合わせる

- 影響: PDF（全体を1ページと、A4に分割の両方）の見た目を、画面とPNGに合わせた。1段おきに地をわずかに暗く（暗い地では明るく）した縞を入れた。縞は盤面全体の段で数えるので、A4分割でページが変わっても縞の位置はずれない。白い地では紙の白を塗らず、縞だけを塗る。罫線は、通常の線を1マスの1/24、10目・10段ごとの太線を2/24の太さにし、極端に小さいマスでも消えないよう下限を0.12pt・0.24ptとした。通常の線の色は、地から線へ寄せる割合をPNGと同じ0.267にした（白い地では`#bbbbbb`）。太線の色は元からPNGと同じ0.6である。変更は`packages/editor-core`の共通部分なので、Web版とiOS版の両方に入る。PDFのレイアウト（用紙・分割・セル寸法・ページ数）は変えていない。
- 主なファイル: `packages/editor-core/export/pdf.worker.ts`、`packages/editor-core/model/boardColors.ts`、`packages/editor-core/export/pdf.worker.test.ts`、`packages/editor-core/model/boardColors.test.ts`
- テスト: `pdf.worker.test.ts`に、白い地では紙を塗らず縞だけを塗ること、暗い地では地の色の上に縞と罫線を重ねること、縞の色と罫線の太さ・色がPNGと同じであること（白・グレー・黒の3つの地）、A4分割の各ページの縞が盤面全体の段で数えて偶数段にそろうことを足した。`boardColors.test.ts`のPDFの罫線色を、PNGと同じ`#bbbbbb`へ更新した。既存の太線のテストは、太さをマスに対する割合から計算する形に直した。
- 検証:
  - `npm run typecheck`、`npm test`（1143件成功）、`npm run build`、`npm run check:dist`が成功した。
  - `npx playwright test tests/e2e/pdf-export-snapshot.spec.ts tests/e2e/export-title-and-legend.spec.ts`（11件成功、1件スキップ）が成功した。`npm run test:e2e`は659件成功、37件スキップ、失敗なしだった。
  - iOS Webは`ios/Web`で`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`と`../../node_modules/.bin/vitest run --config vite.config.ts`（158件成功）を実行した。
  - 実際のエディタから同じ編み図のPNGとPDF（1ページ）を書き出し、白と黒の地で、縞の位置と罫線の太さ・色を並べて目で確かめた。確認画像は`/tmp/compare-*.png`に保存した。グレーの地は単体テストだけである。
  - iOS実機でのPDF表示は、次のリリースで確認する（この環境ではSimulator・実機を動かしていない）。
- デプロイ影響: あり（Pagesへ配信される）。配信後に白・グレー・黒の地でPDFを書き出し、PNGと並べて縞と罫線の見え方を確かめる（#443の完了条件）。iOS版は次回のFull iOS validationと実機確認で同じ出力を確かめる。
