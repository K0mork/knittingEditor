# 2026-10-06 — 開発ログをPRごとのファイルに分け、並行するPRのコンフリクトをなくす

- 影響: アプリとWeb資産の内容は変えていない。記録の置き場所だけを変えた。これまでは各PRがルートの`DEVELOPMENT_LOG.md`の先頭に記録を足していたため、並行して進めたPRは必ず同じ行でコンフリクトし、解消のpushのたびにiOS Simulatorを含むCIが最初から走り直していた。直近10件の「`main`を作業ブランチへ取り込むマージ」で手で解消したコンフリクトは、すべてこのファイルだけだった。
  - 新しい記録は、PRごとに`docs/dev-log/YYYY-MM-DD-<slug>.md`を1つ足して書く。書式は`docs/dev-log/README.md`。
  - ルートの`DEVELOPMENT_LOG.md`は2026-10-06までの凍結アーカイブにし、冒頭にその旨を書いた。`ios/DEVELOPMENT_LOG.md`は今までどおり凍結アーカイブ。
  - 記録先を指していた規則と文書を書き換えた。`docs/ARCHITECTURE.md`の「本番公開後の確認を記録する」は、今の規則（マージしたPRへのコメントで報告する）に合わせた。
  - CIの変更範囲の判定は`*.md`と`docs/*`をWeb・iOSのビルド入力に数えないので、記録のファイルを足してもCIの範囲は広がらない。
- 主なファイル: `AGENTS.md`、`ios/AGENTS.md`、`docs/dev-log/README.md`、`DEVELOPMENT_LOG.md`、`ios/DEVELOPMENT.md`、`docs/ARCHITECTURE.md`、`ios/docs/APP_STORE_METADATA.md`、`ios/docs/PRO_PLAN.md`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`
- テスト: なし（規則と文書の変更）。
- 検証: `ios/scripts/check-app-store-docs.sh`と`git diff --check`が成功した。`git grep DEVELOPMENT_LOG`で、凍結アーカイブを指す箇所と`.github/dependabot.yml`のコメント（Dependabotの依存更新PRは記録不要、という内容で今も正しい）のほかに、古い記録先が残っていないことを確かめた。Markdownだけの変更のため、Webの検査一式とiOSの検査は実行していない（CIでもskipされる）。
- デプロイ影響: なし。Markdownだけの変更で、Pagesは再配信されない。
