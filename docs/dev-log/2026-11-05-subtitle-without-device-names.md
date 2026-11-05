# 2026-11-05 — App StoreのサブタイトルからiPhone・iPadを外す

- 影響: v1.0の審査が、ガイドライン5.2.5（法的事項：知的財産）で却下された。サブタイトル「iPhone・iPadで簡単に編み図を作成」の「iPhone」「iPad」が、Appleの製品名の不適切な使い方とされた。利用者の決定で、サブタイトルを「編み図を簡単に作成・印刷」に変えた。プロモーションテキストと説明文の「iPhone・iPadで」は、対応端末を説明する書き方で指摘されていないので残した。却下の内容と対応を提出の記録と手順書に書き、v1.0に入れていない製品ページのヘッダ画像の見出し（「棒針の編み図を、iPhoneとiPadで。」）も入れる前に見直すことを書いた。`ios/scripts/check-app-store-docs.sh`は、App名・サブタイトル・キーワードにAppleの製品名（iPhone、iPad、Macなど。カタカナのアイフォン・アイパッドも含む）があると失敗するようにした。手順書の手順7には、却下されたときのアプリの状態ごとの対応を書いた。Metadata Rejectedなら直して審査担当者に返信し、Rejectedなら直して再提出する。返信は再提出の前に送る。
- 主なファイル: `ios/docs/APP_STORE_METADATA.md`、`ios/docs/RELEASE_VERIFICATION_RECORDS.md`、`ios/docs/RELEASE_RUNBOOK.md`、`ios/docs/SCREENSHOTS.md`、`ios/scripts/check-app-store-docs.sh`、`scripts/app-privacy-docs.test.mjs`
- テスト: `scripts/app-privacy-docs.test.mjs`に、サブタイトル（英字・小文字・カタカナ）、App名、キーワードに製品名があると検査が失敗するテストを5件足した。
- 検証: `sh ios/scripts/check-app-store-docs.sh`（成功）、旧サブタイトルに戻すと`サブタイトル (iPhone)`で失敗することを手で確かめた、`npx vitest run scripts/app-privacy-docs.test.mjs`（22件成功）、`npm test`（82ファイル・1060件成功）、`git diff --check`（成功）。WebとiOSのコードは変えていないので、ビルド・E2E・Simulatorのテストは実行していない。
- デプロイ影響: なし。Pagesは再配信されず、アプリのビルドも変わらない。利用者が、App Store Connectの「App情報」でサブタイトルを「編み図を簡単に作成・印刷」に替え、2026-11-05 17:22（JST）にビルド1のまま再提出した。ヘッダと検索結果の画像が版1.0に無いことも確かめた。
