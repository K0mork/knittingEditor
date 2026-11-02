# 2026-11-02 — Apple Developer Programへの加入が済んだことを手順書に反映する

- 影響: iOS v1.0の提出手順書を、加入前の書き方から加入後の書き方に直した。手順1〜3（提出前の準備、個人での加入、有料のTeamでのAutomatic署名）を済みとし、次は手順4のApp Store Connectでのアプリ登録から進めると書いた。加入の手続き（本人確認・問い合わせ）の進め方は手順書から外し、経緯は非公開の記録にあるとだけ書いた。手順3には設定し直すときの手順を残し、M0の機内モードの確認は手順8でTestFlightの提出ビルドを使って行うと書いた。題名は「v1.0 提出・公開の手順」に変えた。ほかの文書でも、加入する予定・方針としていた箇所を加入済みに直し、機内モードでXCUITestを起動できないのは有料のTeamでも同じだと書いた。日付の付いた過去の確認記録は直していない。
- 主なファイル: `ios/docs/RELEASE_RUNBOOK.md`、`ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/APP_STORE_METADATA.md`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`、`ios/README.md`
- テスト: なし（文書だけの変更）
- 検証: `ios/scripts/check-app-store-docs.sh`、`node scripts/check-pr-smoke-ui-tests.mjs`、`git diff --check`
- デプロイ影響: なし。Pagesは再配信されない。TestFlight／App Storeへの影響もない。
