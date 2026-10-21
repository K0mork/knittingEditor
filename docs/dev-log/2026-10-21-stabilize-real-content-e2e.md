# 2026-10-21 — 記号を描いて比べるE2Eを20×20の初期表示から始める

- 影響: テストだけの変更で、アプリの挙動は変わらない。#310のマージ後、mainの`CI and deploy Pages`の`web`ジョブで、webkit-mobileの「copies colored symbols including a multi-cell stitch to new positions and undoes the paste」が1回失敗し、Pagesへの配信が止まった（1件目の貼付で、4マスのうち1マスしか保存されていなかった）。#310で、新しい編み図の既定の大きさが150段×60目になったため、このテストは「盤面」パネルで20×20へ縮めてから記号を描くようにした。大きさを変えた盤面は、変更前の表示位置を引き継ぐ。そのため、縮めた直後に盤面の位置を測ると、マスの座標の前提が#310より前と変わり、タイミングによってずれうる。線のテスト（`guide-lines.spec.ts`）と同じく、保存を待って読み込み直し、20×20の初期表示から始めるようにした。#310より前の、既定の20×20の初期表示と同じ条件になる。
- 主なファイル: `tests/e2e/editor.spec.ts`
- テスト: `drawRealContent`を`resizeBoard`から`resizeBoardFromInitialView`（`tests/e2e/board-helpers.ts`、#310で追加）に変えた。これを使う「copies colored symbols…」と「exports real symbol pixels and restores a full backup block for pasting」が対象。
- 検証（手元、Node.js 26.8.1。AGENTS.mdの指定のNode.js 24はこのMacに入っていないため、Node.js 24での確認はPRのCIに任せる）:
  - 失敗したテストを、変更前のコードのままwebkit-mobileで30回繰り返したが、手元では再現しなかった。CIの成果物（trace）は残っていなかった。mainの過去の失敗した実行にも、このテストの失敗は無かった。
  - 変更後、対象の2テストを3プロジェクトで5回ずつ実行: 30件成功
  - `npm run typecheck`: 成功
  - `npm test`: 69ファイル・732件成功
  - `npm run build`、`npm run check:dist`: 成功
  - `npm run test:e2e`: Chromium（mobile・desktop）とWebKit（mobile）で518件成功、7件は条件付きで飛ばすテスト
- デプロイ影響: テストだけの変更。マージすると、#310の変更を含むmainが`web`ジョブを通ってPagesへ配信される。配信後は https://knittingeditor.com/ で、既存の編み図が元の大きさのまま開くこと、「新しい編み図」が150段×60目で作られ、編み始めが右下に見えることを確かめる。
