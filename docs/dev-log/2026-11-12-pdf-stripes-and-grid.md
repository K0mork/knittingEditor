# 2026-11-12 — PDFの縞と罫線をPNGに合わせる

- 影響: PDF（全体を1ページと、A4に分割の両方）の見た目を、画面とPNGに合わせた。1段おきに地をわずかに暗く（暗い地では明るく）した縞を入れた。縞は盤面全体の段で数えるので、A4分割でページが変わっても縞の位置はずれない。白い地では紙の白を塗らず、縞だけを塗る。罫線は、通常の線を1マスの1/24、10目・10段ごとの太線を2/24の太さにし、極端に小さいマスでも消えないよう下限を0.12pt・0.24ptとした。通常の線の色は、地から線へ寄せる割合をPNGと同じ0.267にした（白い地では`#bbbbbb`）。太線の色は元からPNGと同じ0.6である。PDFの一覧（凡例）も同じ罫線描画を使うため、一覧の通常の線もマスの1/24・白い地では`#bbbbbb`になり、PNGの一覧に近づいた。変更は`packages/editor-core`の共通部分なので、Web版とiOS版の両方に入る。PDFのレイアウト（用紙・分割・セル寸法・ページ数）は変えていない。
- 主なファイル: `packages/editor-core/export/pdf.worker.ts`、`packages/editor-core/model/boardColors.ts`、`packages/editor-core/export/pdf.worker.test.ts`、`packages/editor-core/model/boardColors.test.ts`
- テスト: `pdf.worker.test.ts`に、白い地では紙を塗らず縞だけを塗ること、暗い地では地の色の上に縞と罫線を重ねること、縞の色と罫線の太さ・色がPNGと同じであること（白・グレー・黒の3つの地）、A4分割の各ページの縞が画面やPNGと同じく盤面全体の段で数えてそろうこと（上からの段番号で偶奇が決まるため、段数が奇数なら縞は奇数段）を足した。60段を6mmで分割して2ページ目が奇数段から始まる場合の縞の位置と、罫線の太さが`3.000 w`・`6.000 w`（72ptのマス）と`0.120 w`・`0.240 w`（0.5mmのマス）になることを、ヘルパーを経由せずリテラルで確かめるテストも足した。`boardColors.test.ts`のPDFの罫線色を、PNGと同じ`#bbbbbb`へ更新した。既存の太線のテストは、太さをマスに対する割合から計算する形に直した。
- 検証:
  - 実装時は`npm run typecheck`、`npm test`（1143件成功）、`npm run build`、`npm run check:dist`が成功した。
  - `npx playwright test tests/e2e/pdf-export-snapshot.spec.ts tests/e2e/export-title-and-legend.spec.ts`（11件成功、1件スキップ）が成功した。`npm run test:e2e`は659件成功、37件スキップ、失敗なしだった。
  - iOS Webは`ios/Web`で`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`と`../../node_modules/.bin/vitest run --config vite.config.ts`（158件成功）を実行した。
  - 実際のエディタから同じ編み図のPNGとPDF（1ページ）を書き出し、白と黒の地で、縞の位置と罫線の太さ・色を並べて目で確かめた。確認画像は`/tmp/compare-*.png`に保存した。グレーの地は単体テストだけである。
  - リードが、このブランチの本番ビルドをChromium（デスクトップ）で開き、白・グレー（`#808080`）・黒（`#1e1e1e`）の3つの地に3つの記号を置いた60段×30目の編み図を、PNG、1ページのPDF、6mmセルのA4縦分割PDF（2ページ、1ページ目は段17〜60、2ページ目は段1〜17）で書き出した。PDFのページはmacOSのPDFKitで描画し、PNGと並べて比べた。3つの地とも縞がPNGと同じ段にあり、分割した2ページの間でも重なった段を含めてそろっていた。通常の線と太線の太さ・色もPNGと同じに見えた。iOS実機での確認はまだ行っていない。
  - レビュー対応後、`npm run typecheck`、`npx vitest run packages/editor-core/export/pdf.worker.test.ts packages/editor-core/model/boardColors.test.ts`（80件成功）、`npm test`（1145件中1139件成功、6件失敗）を実行した。`node_modules`があったため`npm ci`は実行していない。`npm test`の失敗は、他の作業でマシンが混み合っていたときの時間切れと性能しきい値（`scripts/clean-worktrees.test.mjs`の3件、`bridgeMeasurementData.test.ts`の1件、`pdf.worker.test.ts`の100万マスの1件、`thumbnail.test.ts`の1件）で、変更箇所の失敗ではない。個別に再実行すると`pdf.worker.test.ts`は71件、`bridgeMeasurementData.test.ts`は2件、`clean-worktrees.test.mjs`は`--testTimeout=30000`で24件が成功し、`thumbnail.test.ts`だけは単独でも1件失敗した（331ms、上限250ms）。
  - 新しい奇数段のテストが回帰を捕まえることを確かめた。`pdf.worker.ts`の縞の条件を一時的に`localRow % 2`へ変えて`npx vitest run packages/editor-core/export/pdf.worker.test.ts -t "counts the 1-row stripes on the whole board when a page starts on an odd row"`を実行すると、2ページ目が期待の段44〜58ではなく段43〜59に縞を置いて失敗した。実装を元に戻し、`git diff -- packages/editor-core/export/pdf.worker.ts`が空であることを確認した。
  - iOS実機でのPDF表示は、次のリリースで確認する（この環境ではSimulator・実機を動かしていない）。
  - 負荷の少ない状態で全体をやり直し、`npm run typecheck`、`npm test`（1145件成功）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（659件成功、37件スキップ、失敗なし）が成功した。
- デプロイ影響: あり（Pagesへ配信される）。配信後に白・グレー・黒の地でPDFを書き出し、PNGと並べて縞と罫線の見え方を確かめる（#443の完了条件）。iOS版は次回のFull iOS validationと実機確認で同じ出力を確かめる。
