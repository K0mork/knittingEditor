# 2026-10-21 — アプリのプライバシーポリシーに写真への保存を書く

- 影響: 公開しているアプリのプライバシーポリシー（`https://knittingeditor.com/privacy/app/`）の「ファイルと共有」に、PNGは共有メニューの「画像を保存」を選んだ場合にだけ「写真」へ追加し、写真への追加の許可だけを求め、「写真」に保存されている写真やビデオは読み取らないことを足した。アプリは`NSPhotoLibraryAddUsageDescription`だけを持ち、読み取りの`NSPhotoLibraryUsageDescription`は持たない（`ios/App/Info.plist`）。同梱の使い方の「写真への保存を許可する」と合わせた。改定日を2026年10月21日にした。アプリの動作は変えていない。
- 主なファイル: `public/privacy/app/index.html`、`tests/e2e/seo.spec.ts`
- テスト: `tests/e2e/seo.spec.ts`のアプリのプライバシーポリシーのテストで、改定日の更新と、写真を読み取らないことの記述を確かめるようにした。
- 検証: `npm ci`、`npm run typecheck`、`npm test`（69ファイル709件成功）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium・WebKit、515件成功・7件は既存のスキップ）がすべて成功した。iOSのコードは変えていないので、Simulatorのテストは実行していない（PRのCIは変更範囲に応じて判断する）。
- デプロイ影響: Pagesの`/privacy/app/`が更新される。デプロイ後に`https://knittingeditor.com/privacy/app/`で追記と改定日が出ていることを確かめる。App Store Connectに登録するURLは変わらない。
