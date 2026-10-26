# 2026-10-26 — Playwright失敗時の診断ファイルをCIに保存

- 影響: Issue #339。WebのE2Eステップが失敗した場合だけ`test-results/`全体を専用artifactに保存する。先行する別ステップの失敗では保存しない。run IDと試行番号で名前を分け、調査用に7日保持する。ファイルがない場合は警告とし、元のテスト失敗は維持する。キャンセル時の保存は保証しない。
- 主なファイル: `.github/workflows/ci.yml`、`scripts/playwright-artifacts.test.mjs`。既存のSHA固定upload-artifactを使用。Playwrightは既に`retain-on-failure`で、再試行なしでも初回失敗のtraceが残る。既定出力先は`test-results/`、reporterはlistのため設定変更は不要。
- テスト: E2E失敗に限定した保存条件、失敗を隠さない設定、Pages成果物との分離、保存先・保持期間・試行別の命名を静的回帰テストで確認。隣接ジョブ名に依存せず、対象ジョブ・ステップ欠落時には明示的に失敗する。
- 検証:
  - `node --version`: `v26.8.1`（CIはNode 24）。
  - `npm test -- scripts/playwright-artifacts.test.mjs`: 成功。
  - `ruby -ryaml -e 'workflow = YAML.load_file(".github/workflows/ci.yml"); abort "missing web job" unless workflow.fetch("jobs").key?("web")'`: 成功。
  - `npm run typecheck`: 成功。
  - `npm test`: 76ファイル・916件成功。
  - `npm run build`、`npm run check:dist`: 成功。
  - `cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: 成功。
  - `cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts`: 17ファイル・145件成功。
  - `npm run test:e2e`: 全project（Chromium・WebKit）で530件成功・7件スキップ。
  - `git diff --check`: 成功。
  - PRのCIでの確認: TODO(lead)
- デプロイ影響: 配信サイト内容・Pages成果物・deploy／smoke／ci-gateの条件・権限・依存関係は変更なし。配信後の追加確認はなし。
