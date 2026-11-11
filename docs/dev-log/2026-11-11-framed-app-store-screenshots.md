# 2026-11-11 — App Storeのスクリーンショットを、Appleの製品ベゼルに入れたデザインに作り直す

- 影響: App Store Connectに登録するスクリーンショット25枚（iPhone 6.9インチ・6.3インチ、iPad 13インチ、iPhone Duoの外側・内側）を、#434の決定に沿って作り直した。画面をAppleのデザインリソースの製品ベゼル（iPhone 18 Pro Max、iPad Pro (M5) 13インチ、iPhone Duo）に入れた。背景はクリーム`#f8eed8`、説明文は深緑`#18482b`にした。画面・順・説明文・提出サイズは変えていない。ベゼルは利用許諾により配れないため、リポジトリに入れない。ベゼルのディスクイメージを開いた状態で、生成スクリプトが画面の画像と合成する。製品ページのヘッダの画像の元（`universal.html`）も、同じ画面の画像を読むようにした。見た目は変わらない。App Store Connectへの登録は1.2の版で行う（#439）。
- 主なファイル: `scripts/generate-app-store-screenshots.mjs`（新規）、`ios/design/app-store-screenshots/screens/`（新規、画面の画像20枚）、`ios/docs/screenshots/app-store-*.png`、`ios/design/app-store-creative/universal.html`、`ios/docs/SCREENSHOTS.md`、`ios/docs/APP_STORE_METADATA.md`。
- テスト: 追加していない。生成スクリプトは、利用者がベゼルの利用許諾に同意して開いたディスクイメージとmacOSのフォントを使う。このためCIでは実行できず、書き出した画像を確かめた。
- 検証:
  - `node scripts/generate-app-store-screenshots.mjs`で25枚を書き出した。`sips`で、すべて提出サイズ（6.9インチ1320×2868、6.3インチ1206×2622、iPad 13インチ2064×2752、Duo外側1398×2034・内側2007×2853）で、透過なしであることを確かめた。端末ごとに5枚を並べて目で確かめた。画面の角がベゼルの外にはみ出さないことも確かめた。
  - 画面の画像20枚は、それまでの提出画像の画面の部分と、画素が一致することを確かめた。
  - `universal.html`を`npx playwright screenshot`で書き出し、前の画像と比べた。違いは画面の縮小の位置が半画素ずれたことだけで、見た目は同じだった（iPadの画面の上端に1画素あった帯の緑がなくなった）。5244×2950・透過なし。
  - `sh ios/scripts/check-app-store-docs.sh`、`npm test`、`git diff --check`が成功した。
  - 手元で確かめていないこと: App Store Connectのプレビューでの見え方。1.2の版を作るときに、登録と合わせて確かめる（#439）。
- デプロイ影響: なし。Web版とアプリのビルドは変わらない。App Storeの画像は登録していない。
