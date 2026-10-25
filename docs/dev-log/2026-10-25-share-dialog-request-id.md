# 2026-10-25 — Web版の共有ダイアログで、前の共有の完了を次のファイルの結果にしない

- 影響: iPhone・iPadのSafariで、出力を2件続けて生成し、1件目を共有シートで共有している間に2件目の「共有・保存」ダイアログへ置き換わった場合、1件目の共有シートを閉じた時点で2件目のダイアログまで閉じ、2件目を共有していないのに「共有した」と返していた。2件目が`.knit`のバックアップなら書き出し日時が記録され、書き出しを勧める帯が消えていた。共有ダイアログの要求に番号を付け、ダイアログの結果はそれを開いた要求にだけ返すようにした。置き換わった前の要求は、従来どおり置き換えた時点で「共有しなかった」（`false`）として返し、後から届いた完了は捨てる。ダイアログのkeyもファイル名から要求番号に変え、同じ名前のファイルに置き換わっても前のダイアログの「共有中」（ボタンの無効化）を引き継がない。見た目と、1件だけを共有する通常の操作は変わらない。
- 主なファイル: `src/ShareFileDialog.tsx`, `src/ShareFileDialog.test.tsx`
- テスト: `src/ShareFileDialog.test.tsx`に5件を追加。修正の前に、守られていなかった既存の性質3件（共有シート表示中はEscape・背景タップで閉じない、ダイアログの外側の押下とEscapeだけで閉じ内側の押下では閉じない、ホストのunmountで未回答の要求を`false`で返す）を足し、現行コードで通ることを確かめた。続けて、共有中に別名のファイルへ置き換わり前の共有が完了しても次のダイアログが閉じず結果も返らないこと、同名のファイルへ置き換わっても「共有中」を引き継がないことの回帰テスト2件を足し、修正前のコードで失敗することを確かめてから修正した。修正後、ガードを1つずつ外した版（共有中の閉じる抑止、unmount時の後処理、背景の押下判定、置き換え時の`false`、要求番号の照合、要求番号のkey）でいずれかのテストが失敗することを確かめた（一時的な書き換えで、元に戻した）。
- 検証: 手元はNode 26.8.1（CIはNode 24）。
  - `npx vitest run src/ShareFileDialog.test.tsx` — 修正前: 2 failed | 8 passed（追加した回帰テスト2件だけが失敗）。修正後: 10 passed。
  - `npm run typecheck` — 成功。
  - `npm test` — 3回実行し、集計を確かめた2回はどちらも 1 failed | 787 passed。失敗は今回触れていない`packages/editor-core/model/thumbnail.test.ts`の所要時間の上限（250ms）で、ほかのエージェントが並行して動きload averageが20〜29の状態で約303msだった。`npx vitest run packages/editor-core/model/thumbnail.test.ts`単独では18 passed、`npm test -- --maxWorkers=2`では71 files / 788 tests passed。
  - `npm run build` — 成功。
  - `npm run check:dist` — `dist verified`。
  - `npx playwright test tests/e2e/editor.spec.ts tests/e2e/backup-reminder.spec.ts tests/e2e/backup-pipeline.spec.ts`（共有ダイアログを使うspec、全project）— 123 passed、6 skipped（共有シートの3件は`webkit-mobile`専用で、Chromiumの2 projectでは意図どおりskip）。
  - `npm test -- --maxWorkers=2`（コミット後に再実行）— 71 files / 788 tests passed。
  - `npm run test:e2e`（全project）— 524 passed、7 skipped。`packages/`・`ios/Web/`は変更していないので、iOS Webの型検査・テストとSimulatorの検証は対象外（PRのCIの判定に任せる）。
- デプロイ影響: Pagesへ配信される（Web版のみ。iOS版は`ShareFileDialog.tsx`を使わない）。`smoke`のほかに配信後に確かめることは無い。実機で確かめる場合は、iPhone・iPadのSafariで1件の出力を「共有・保存」から共有できることを見る。
