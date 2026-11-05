# 2026-11-05 — 文書検査テストの誤検出・見逃しと、文書間の循環参照を直す

- 影響: #416・#417・#418 のレビューで見つけた点を直した。利用者向けの画面・出力は変えていない。
  - 記号件数の検査は「N種類の編み目記号」（`llms.txt` は「N種類の選択肢」）だけを照合し、記号と関係のない「3種類」のような文で失敗しないようにした。
  - 使い方ページの共通説明の検査は、一致する段落・見出しの数を下限ではなく一致で比べ、共通部分が増えたあとの片側だけの変更も検出するようにした。
  - `AGENTS.md` と `docs/ARCHITECTURE.md` が互いを正本として参照し合っていたため、ジョブ構成は `docs/ARCHITECTURE.md`、マージ・公開・完了確認の手順は `AGENTS.md` の Deployment Procedure と分担を明記した。
- 主なファイル: `scripts/stitch-count.test.mjs`、`scripts/guide-content.test.mjs`、`AGENTS.md`、`docs/ARCHITECTURE.md`
- テスト: 上の2つのテストを更新した。READMEに「3種類のファイル形式」を足しても件数検査が通り、使い方ページの件数を28に変えると失敗することを一時的な書き換えで確かめ、元に戻した。
- 検証: `npx vitest run scripts/stitch-count.test.mjs scripts/guide-content.test.mjs scripts/japanese-punctuation.test.mjs`（19件成功）、`npm run typecheck`（成功）、`git diff --check`（成功）。全体の `npm test` は1000件成功したが、このworktreeではワークスペースのWorkerモジュールがViteの許可ルート外に解決されて `src/` の4スイートが起動できないため、全体の確認はPR CIの `web` ジョブで行う。`npm run build`・`npm run check:dist`・`npm run test:e2e` は、ビルド入力を変えていないためローカルでは実行せず、PR CIに任せる。
- デプロイ影響: なし（テストと文書のみ）。
