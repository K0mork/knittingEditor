# 2026-11-03 — TestFlightでの提出ビルドの実機確認を記録する

- 影響: 審査に出したv1.0のビルド1（`b0a7f26`）をTestFlightの内部テストでiPhone 17とiPad Air 第5世代に入れ、利用者が手で確かめた結果を記録した。機内モードでの主な操作（M0・M6）、1000×1000盤面とPNGの上限超過（M2）、Files・AirDrop・異常系（M3）、画面と表示名（M4・M6）、TestFlightのクラッシュと端末の解析データ（#26）は、両端末とも問題が無かった。オフラインでダウンロードされていないiCloud Driveの`.knit`を開くと、落ちないが理由の分からない「バックアップを読み込めませんでした」が出る。利用者の判断で、v1.0では合格とし#387で扱う。手順書の冒頭は「次は承認を待って手順9」にした。アプリのコードは変えていない。
- 主なファイル: `ios/docs/RELEASE_VERIFICATION_RECORDS.md`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`、`ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/RELEASE_RUNBOOK.md`
- テスト: 追加・変更なし（文書だけの変更）。
- 検証: 実機の確認は利用者がTestFlightの1.0 (1)で行った（内容は`RELEASE_VERIFICATION_RECORDS.md`の同日の節）。メモリの値と、読み込み直前のファイル削除（開発ビルドとLLDBが要る）は確かめていない。`bash ios/scripts/check-app-store-docs.sh`（成功）、`npx vitest run scripts/app-privacy-docs.test.mjs`（17件成功）、`git diff --check`（成功）。足した記録の節へのリンク3か所が見出しと一致することを確かめた。
- デプロイ影響: なし。Pagesは再配信されない。アプリのビルドにも影響しない。v1.0は承認を待って手動で公開する。
