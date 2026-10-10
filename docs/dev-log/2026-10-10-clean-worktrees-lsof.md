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
  - 初回の`npm run typecheck && npm test && npm run build && npm run check:dist`：依存関係導入前は親チェックアウトのVite一時ファイルへの書き込み制限でテスト起動に失敗。`npm ci`後のNode 26実行は型検査成功、テスト262件成功・既存サムネイル性能テスト1件失敗（349ms、上限250ms）。後続のビルドと配信物検査はこの実行では未実行。Node 24で上記一式を再実行し成功。
- 未実行: Chromium/WebKit E2Eはsandboxで起動できないため検証担当へ委ねる。ブラウザー挙動の変更はない。iOSコード・共通コードは変更せず、iOS Web検査、ビルド、Simulator、更新復元、Archiveは対象外。適用されるPR CIの確認は別途必要。
- デプロイ影響: none。整理スクリプトのみの変更で、配信後の画面確認は不要。
