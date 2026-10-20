# 2026-10-20 — App Store提出用のスクリーンショットを説明文入りで撮り直す（#290）

- 影響: App Store Connectに登録するスクリーンショットを、今のUIで撮り直し、説明文入りの最終版にした。iPhone 6.9インチ（1320×2868）とiPad 13インチ（2064×2752）のそれぞれ5枚で、画面は編集画面・記号の選択・出力・背景色・ダークモード。文面は「29種類の編み目記号で作る」「記号は一覧から選ぶだけ」「PDFにしてA4で印刷」「背景色を変えて見やすく」「ダークモードにも対応」。2026-09-22に撮った古い提出用の3枚（編集画面2枚と起動画面）は、今の画面と合わないので削除した。アプリとWebの動作は変えていない。
- 主なファイル:
  - `ios/docs/screenshots/app-store-iphone-6.9-0[1-5]-*.png`、`ios/docs/screenshots/app-store-ipad-13-0[1-5]-*.png`（新規）。
  - `ios/docs/SCREENSHOTS.md`: 提出用の10枚、各画面に写っているもの、取得条件（端末、ビルド、ステータスバー、撮影用の編み図、説明文の付け方）。
  - `ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/APP_STORE_METADATA.md`: 最終版ができたことに合わせた。
  - `ios/scripts/check-release-assets.sh`: 10枚の解像度を検査する。`ios/scripts/check-app-store-docs.sh`: 10枚が`SCREENSHOTS.md`に載っていることを検査する。
- テスト: 検査スクリプトの対象を新しいファイル名に変えた。新しいテストは足していない。
- 検証（Node v26.8.1）:
  - `sh ios/scripts/check-app-store-docs.sh`: 成功。
  - `sh ios/scripts/check-release-assets.sh <Releaseの.app>`（`main`の`aa53a3a`をXcode 27.1でRelease設定でビルドしたもの）: 成功。10枚の解像度を含む。
  - `npm test -- scripts`: 10ファイル・91件成功。
  - `node scripts/check-pr-smoke-ui-tests.mjs`、`git diff --check`: 成功。
  - 撮影は、iPhone 18 Pro MaxとiPad Pro 13-inch (M5)（どちらもiOS 27.0）のSimulatorを新しく作って行い、撮影のあとで削除した。
  - 撮影の途中で、iPadのSimulatorでは盤面設定の「ほかの色を選ぶ」から色の選択画面が開かなかった（iPhoneでは開く）。調べた結果、アプリの不具合ではなかった。色の選択画面を出すシステムのプロセスの起動が、Simulatorの起動直後やMacが重いときに間に合わず、システムが表示をやめる（Safariでも同じ条件で起きた）。実機では試していない。
- デプロイ影響: なし。文書と画像だけで、Pagesの配信物もアプリも変わらない。App Store Connectへの登録は、加入後に#27で行う。
