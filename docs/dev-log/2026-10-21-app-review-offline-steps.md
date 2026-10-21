# 2026-10-21 — 審査メモの端末内保存と確認操作を補足

- 影響: 英日両方の審査メモで、機内モードでは端末内へ保存し、同じ場所から復元する手順と「決定」「ファイルに保存」の操作を明記した。AirDrop・共有先の確認は機内モードの手順と分けた（#306）。アプリの動作変更はない。
- 主なファイル: `ios/docs/APP_REVIEW_NOTES.md`
- テスト: 追加・更新なし（Markdownのみの変更）。
- 検証: `sh ios/scripts/check-app-store-docs.sh`、`git diff --check`は成功。操作名を`ios/Web/src/AppDialog.tsx`、`ios/App/WebViewContainer.swift`と照合した。Web・Simulatorのテスト、提出ビルドでの実機確認は文書のみの変更のため未実施。PRの文書検査と`ci-gate`はCIで確認する。
- デプロイ影響: なし。App Store Connectへの転記と提出ビルドでの最終確認は提出時に行う。
