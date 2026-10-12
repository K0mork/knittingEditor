# 2026-10-12 — iPadのCIでは端末で挙動が変わらないUIテストを除く

- 影響: `ios`ジョブのiPad (A16)では、端末によって挙動が変わらないと分類したUIテスト12件だけを`-skip-testing`で除き、残りのUIテストと単体テストはすべて実行する。新しいUIテストは何もしなくても両方の端末で実行される。iPhoneのジョブと両端末の`app_update`は変えていない。GitHubで同時に動けるmacOSのジョブは5つまでで、1回のCIがその枠を占める時間を減らすため。
- 主なファイル: `.github/workflows/ci.yml`、`ios/UITests/ipad-skipped-ui-tests.txt`（除くテストと理由）、`scripts/check-ipad-ui-tests.mjs`、`scripts/check-ipad-ui-tests.test.mjs`、`AGENTS.md`。
- 時間の見込み: 直近のiPadのCIのログでは、UIテストの合計が約19分15秒、除いたあとに残る25件が約13分22秒で、約5分53秒短くなる見込み。ビルドやSimulatorの起動は含まない。
- テスト: 除外リストの検査（名前が実在すること、重複・書式、空のリストは除外なしとして許すこと）を`scripts/check-ipad-ui-tests.test.mjs`で確かめる。検査は常に動くUbuntuの`app_store_docs`ジョブで実行し、テストの改名や削除で除外リストが古くなったら失敗する。
- 検証（Node 24）: `npm test -- scripts/`（7ファイル・75件）、`npm run typecheck`、`node scripts/check-ipad-ui-tests.mjs`（除外12件の実在を確認）、`ruby -ryaml -e 'YAML.load_file(ARGV[0])' .github/workflows/ci.yml`、`git diff --check`が成功。iPadのステップを取り出して`xcodebuild`を置き換えたシェルで、12件の`-skip-testing`が渡ること、空のリストでは除外がないこと、iPhoneのコマンドが変わっていないことを確かめた。実際のiPadの実行対象と所要時間はこのPRのCIで確かめる。
- 未対応: `ios/AGENTS.md`と`ios/DEVELOPMENT.md`のCIの説明は、同じファイルを変えるPR #241のマージ後にそろえる。
- デプロイ影響: なし。
