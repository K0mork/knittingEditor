# 2026-11-03 — 読み込み直前にファイルを消す実機の確認を記録する

- 影響: リリース前の実機チェックリストのM3で残っていた、`.knit`を読み込む直前にファイルが消えたときの確認を、iPhone 17とiPad Air 第5世代で行った。起動中・使い方ページの表示中・終了した状態から開く場合と「バックアップから復元」のどれも、落ちずに「バックアップを読み込めませんでした」が出た。M3と提出チェックリストのFiles・異常系の項目をチェック済みにし、チェックリストにあった古いブレークポイントの場所を、今の`WebViewModel.swift`と`PickedBackupFile.swift`に直した。アプリのコードは変えていない。
- 主なファイル: `ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`、`ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/RELEASE_RUNBOOK.md`、`ios/docs/RELEASE_VERIFICATION_RECORDS.md`
- テスト: 追加・変更なし（文書だけの変更）。
- 検証: `main`の`ce40940`をDebugで両端末向けにビルドし（`xcodebuild build -configuration Debug -destination id=<UDID> -allowProvisioningUpdates`）、`devicectl`で入れて、`lldb`でつないで確かめた。内容は`RELEASE_VERIFICATION_RECORDS.md`の同日の節。`bash ios/scripts/check-app-store-docs.sh`、`git diff --check`。
- デプロイ影響: なし。Pagesは再配信されない。アプリのビルドにも影響しない。両端末のアプリは開発ビルドに置き換わっている。
