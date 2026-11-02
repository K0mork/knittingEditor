# 2026-11-02 — 審査への提出とTestFlightでの提出ビルドの確認を並行して進める

- 影響: iOS v1.0の提出手順を、TestFlightで提出ビルドを実機で確かめ終えてから審査に出す順から、アップロードしたビルドをすぐ審査に出し、審査を待つ間に同じビルドをTestFlightで確かめる順に変えた。提出ビルドの実機確認は、提出の条件ではなく公開の条件にした。確認が承認より後に終わっても先に公開されないよう、公開方法は手動公開にする。問題が見つかったら審査から取り下げるか、公開待ちのビルドを却下して、新しいビルドで出し直す。Appleは提出の前にTestFlightを通すことを求めておらず、提出を早めるために利用者が決めた。
- 主なファイル: `ios/docs/RELEASE_RUNBOOK.md`（手順6〜9の順と内容）、`ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`、`ios/docs/APP_STORE_METADATA.md`
- テスト: なし（手順書だけの変更）
- 検証: `ios/scripts/check-app-store-docs.sh`
- デプロイ影響: なし。Pagesは再配信されない。TestFlight／App Storeへの影響もない（提出の手順だけが変わる）。
