# 2026-11-03 — App Store Connectでのアプリの登録を手順書に反映する

- 影響: App Store Connectで新規App（iOS、App名「棒針編み図エディタ」、主言語は日本語、Bundle ID `com.k0mork.knittingEditor`）を作成し、v1.0が「提出準備中」になった。App名は重複せずに使えたので、#18の残件（App名が使えるかの確認）が済んだ。提出の手順書では手順4を済みとし、次は手順5の提出用Release Archiveの作成から進めると書いた。メタデータのApp名の節には、登録できたことを書いた。SKUの値は非公開の `private/APP_STORE_CONNECT.md` に記録し、リポジトリには書いていない。
- 主なファイル: `ios/docs/RELEASE_RUNBOOK.md`、`ios/docs/APP_STORE_METADATA.md`
- テスト: なし（文書だけの変更）
- 検証: App Store Connectの画面で、Appのレコードが作成され、iOSアプリのバージョン1.0が「提出準備中」と表示されることを確かめた。`ios/scripts/check-app-store-docs.sh`（成功）、`node scripts/check-pr-smoke-ui-tests.mjs`（成功）、`git diff --check`（成功）。
- デプロイ影響: なし。Pagesは再配信されない。TestFlight／App Storeへの影響もない。
