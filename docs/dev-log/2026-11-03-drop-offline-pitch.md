# 2026-11-03 — App Storeの文面でオフラインを売りにしない

- 影響: オフラインで使えることをアプリの売りにしない方針にし、App Store Connectに入力する文面を直した。サブタイトルは「オフラインで作れる棒針編み図」から「iPhone・iPadで簡単に編み図を作成」に、プロモーションテキストは手軽さと印刷を先に書く文に、説明文は「インターネット接続なしで」と内部の用語（Canvas編集など）を外した文にした。方針と、オフラインで動くことは製品の要件として守ることを`APP_STORE_METADATA.md`に書いた。手順書の、リジェクト時に審査メモの「4.2やオフライン動作の説明」を使うという記述も直した。審査メモの機内モードの指示はPR #383で消す。
- 主なファイル: `ios/docs/APP_STORE_METADATA.md`、`ios/docs/RELEASE_RUNBOOK.md`
- テスト: 追加・変更なし。
- 検証: `bash ios/scripts/check-app-store-docs.sh`（成功。サブタイトルの30文字、プロモーションテキストの170文字の上限も検査する）、`npx vitest run scripts/app-privacy-docs.test.mjs`（15件成功）、`git diff --check`（成功）。
- デプロイ影響: なし。Pagesは再配信されず、アプリのビルドにも影響しない。App Store Connectのサブタイトル（App情報）、プロモーションテキストと概要（版のページ）を、この文面に入れ替える。
