# 2026-11-11 — iOSのアップデート確認を前のリリースから始める

- 影響: Full iOS validationの`app_update`ジョブは、更新前と更新後のアプリを同じコミットから作っていたため、公開中の版が保存した編み図を新しい版が読めるかを確かめていなかった。`ios/scripts/simulate-app-update.sh`は、今のコミットから辿れる最新のリリースのタグ（今は`ios-v1.1-build1`）のソースを取り出して更新前のアプリを作り、そのアプリでfixtureを保存してから、今のコミットのアプリを上書きインストールして読めることを確かめる。別の起点は`APP_UPDATE_BASE_REF`で指定できる。ジョブはタグを取るため`fetch-depth: 0`で取得し、前のリリースのアプリも作る分、上限を40分にした。
- 主なファイル: `ios/scripts/simulate-app-update.sh`、`.github/workflows/ios-full.yml`、`docs/ARCHITECTURE.md`、`ios/DEVELOPMENT.md`
- テスト: 既存のUIテスト`testSeedDocumentForAppUpdateProbe`（前のリリースのもの）と`testUpdatedAppRestoresSeedDocument`（今のコミットのもの）を使う。テストの追加・変更はない。
- 検証: `bash -n ios/scripts/simulate-app-update.sh`、`git diff --check`が成功し、タグの選び方で`ios-v1.1-build1`が選ばれることを確かめた。手元のSimulatorは別の作業が使っていたため、スクリプトは手元で流していない。ブランチでFull iOS validationを手動実行して確かめる。
- デプロイ影響: なし。CIの検証だけで、Pages・アプリの中身は変わらない。
