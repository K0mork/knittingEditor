# 2026-10-29 — 審査メモに画面のボタン以外の操作を書き、更新版の提出手順を加える

- 影響: App Review Guidelinesの2026-10-16の改定で、説明のない機能の禁止が2.5.19として独立した（#352）。画面のボタンに出ない操作は、アプリ内の「使い方」には書いてあったが、審査メモには無かった。審査メモの英語に「Other input methods」、日本語に「画面のボタン以外の操作」の節を足した。Apple Pencilのダブルタップ、iPadのメニューバーとキーボードショートカット（`ios/App/EditorCommands.swift` の割り当てどおり）、トラックパッドのピンチ、システムが出すApp Storeの評価の依頼（StoreKit）を書いた。評価の依頼は初めて起動してから3日間は求めないため（`ios/App/ReviewRequest.swift`）、審査中に表示されることは想定していないとも書いた。提出手順書に「10. 更新版を提出する」を足し、前の版から増えた機能・変わった操作と確認手順を審査メモの英語・日本語の両方に具体的に書く手順を加えた。画面のボタンに出ない操作を足したときは、「使い方」と審査メモの両方に書くことも加えた。文書の検査スクリプトは、審査メモの英語・日本語の両方に、この節の見出しがあることを確かめるようにした。アプリの動作は変えていない。
- 主なファイル: `ios/docs/APP_REVIEW_NOTES.md`、`ios/docs/RELEASE_RUNBOOK.md`、`ios/scripts/check-app-store-docs.sh`、`scripts/app-privacy-docs.test.mjs`
- テスト: `scripts/app-privacy-docs.test.mjs` に、審査メモから英語・日本語の節の見出しを消すと検査が失敗するテストを2件足した。
- 検証:
  - `ios/scripts/check-app-store-docs.sh`: 成功。
  - `node scripts/check-pr-smoke-ui-tests.mjs`: 成功（11件）。
  - `npx vitest run scripts/app-privacy-docs.test.mjs`: 成功（8件）。
  - `npm test`: 成功（76ファイル、927件）。
  - 文書と検査スクリプトだけの変更で、Web・iOSのビルドには入らないため、`npm run typecheck`・`npm run build`・`npm run check:dist`・`npm run test:e2e` とSimulatorのテストは手元で実行していない。PRのCIの `app_store_docs` で検査が通ることを確かめる。
- デプロイ影響: なし（文書と文書の検査だけの変更）。審査メモはv1.0の提出時にApp Store Connectへ転記する。
