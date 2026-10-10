# 2026-10-10 — lsof失敗時のworktree削除を保留

- 対応Issue: Closes #164
- 影響: `lsof`の終了コードが非ゼロでも部分的な標準出力を保持する。一覧が不完全な場合は全worktreeの削除を保留し、対応するブランチも保持する。自身の`process.cwd()`を常に使用中の場所に含める。正常取得時の既存の整理条件は維持する。
- 主なファイル: `scripts/clean-worktrees.mjs`、`scripts/clean-worktrees.test.mjs`
- テスト: 偽の`lsof`で部分成功、出力なしの失敗、実行不能、正常取得、自身のcwd保護と削除判定を検証。実際のworktree削除は行わない。
- 検証:
  - `npm ci`：成功。
  - `npm --cache /private/tmp/g15-npm-cache exec --yes --package=node@24 -- sh -c 'node --version && npm run typecheck && npm test && npm run build && npm run check:dist'`：Node v24.21.0で型検査、全263テスト、ビルド、配信物検査が成功。
  - `npm --cache /private/tmp/g15-npm-cache exec --yes --package=node@24 -- node node_modules/vitest/vitest.mjs run scripts/clean-worktrees.test.mjs`：9テスト成功。最後の期待値追加後も成功。
  - `git diff --check`：成功。
  - Node 26での初回実行では、変更していない既存のサムネイル性能テスト1件が上限（250ms）を超えて失敗した。Node 24で`npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`を実行し、すべて成功。
- 別の担当が独立に差分を確認し、修正を1つずつ外すと追加したテストが失敗すること、偽の`git`・`gh`・`lsof`を使った実行で、作業場所を確かめられないときに削除を見送ることを確かめた。
- 未実行: ブラウザーやiOSの挙動は変更していないため、E2EとiOSの検査はPR CIの結果で確認する。
- デプロイ影響: none。整理スクリプトのみの変更で、配信後の画面確認は不要。
