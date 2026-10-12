# 2026-10-12 — CIをPRの主要検証と、マージ後・夜間のiOS全体検証に分ける

- 影響: PRとmainへのプッシュで動く`CI and deploy Pages`は、Web（Playwright全件）、iOS Web、App Store資料と主要UIテスト一覧の検査、iPhone 17での単体テスト全件と主要UIテスト11件で判定する。`ci-gate`とPagesの配信はこれだけを待つ。新しい`iOS full validation`（`.github/workflows/ios-full.yml`）は、iOSや共有コードを変えたmainへのプッシュ、毎日18:23 UTC、手動実行で、iPhone・iPadのテスト全件、両端末のapp_update、unsigned Release Archiveを実行する。mainや夜間の実行が失敗したら、実行のURLを「Full iOS validation failed」のIssue（`bug`・`priority:P1`・`platform:ios`）に記録する。開いている同名のIssueがあればコメントを足す。GitHubで同時に動けるmacOSのジョブは5つまでで、1回のPRのCIが5つすべてを27分前後占めていたため。
- 主なファイル: `.github/workflows/ci.yml`、`.github/workflows/ios-full.yml`、`ios/UITests/pr-smoke-ui-tests.txt`（主要UIテストと理由）、`scripts/check-pr-smoke-ui-tests.mjs`とテスト、`AGENTS.md`。
- 時間の見込み: 主要UIテストのうち10件は、直近のiPadのCIで計約6分。残る1件（段数・列数の入力）は未計測。準備とビルドの約7分を足して、PRのiOSジョブは約14〜17分の見込み。実際の時間はこのPRのCIで確かめる。
- テスト: 主要UIテスト一覧の検査（名前が実在すること、重複・書式、空の一覧を拒むこと）を`scripts/check-pr-smoke-ui-tests.test.mjs`で確かめる。検査は常に動く`app_store_docs`ジョブと、iOSジョブの実行前に行う。
- 検証（Node 24）: `npm test -- scripts/`（76件）、`npm run typecheck`、`node scripts/check-pr-smoke-ui-tests.mjs`（11件）、両ワークフローのYAMLの読み込み、`sh ios/scripts/check-app-store-docs.sh`、`git diff --check`が成功。ワークフローから取り出したiOSのステップで`xcodebuild`を置き換え、単体テストの全ターゲットと主要UIテストが`-only-testing`で渡ること、単体テストのターゲットがないと失敗することを確かめた。`gh`を置き換えて、Issueを新しく立てるか既存のIssueにコメントするかの分かれ方を確かめた。移す前のジョブがどちらかのワークフローに1回だけあり、`ci-gate`と`deploy`がPRの段階のジョブだけを待つことも確かめた。iOSの実際の実行と所要時間はこのPRのCIで、全体検証とIssueへの記録はマージ後の最初の実行で確かめる。
- 未対応: `ios/AGENTS.md`、`ios/DEVELOPMENT.md`、`ios/README.md`、`ios/docs/*`、`docs/ARCHITECTURE.md`のCIの説明は、同じファイルを変えるPR #241のマージ後にそろえる。
- デプロイ影響: Pagesの配信がiOSの全体検証を待たなくなる。配信の内容・ドメイン・権限は変えていない。マージ後に、Pagesの配信とsmoke、そのコミットの`iOS full validation`の成功を確かめる。
