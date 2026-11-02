# 2026-11-02 — PNGの描画面を確保できなかったときに、壊れた画像を渡さず案内する

- 影響: #26の実機計測（PR #376）で、iPhone 13 mini（iOS 27.2）の1000×1000・1セル7pxのPNGが、Swiftへ163 bytesで届いた（small・medium・largeとも）。iPhone 17とiPad Air 第5世代では19,249,226 bytes（7052×7028 px）だった。保存先を選ぶ画面の縮小画像は真っ黒で、そのまま保存できる状態だった。iPhone 13 miniのsmallとmediumでは、WebKitのGPUプロセスのピークが99.5 MiBで、iPhone 17の約200 MiB（7052×7028×4 bytes ≈ 198 MB の描画面）に届いていなかった。描画面を確保できず、WebKitが例外を出さないまま空の小さな画像を返したとみられる。
  PNGを作ったあと、次の3つを確かめる。どれかが合わなければ保存画面へ渡さず、「端末のメモリが足りず、PNGを作れませんでした。1セルの画素数を下げるか、PDF保存を利用してください。」と出す。
  - 描き終えた描画面の左上の1画素（番号の帯の白い紙）を読み戻し、不透明の白か。確保に失敗した描画面は透明のまま読める。
  - できたPNGの先頭のIHDRの幅と高さが、描画面の寸法と同じか。
  - PNGの大きさが、その寸法のPNGが取りうる最小のバイト数（1画素1ビットを最大の圧縮率1032:1で縮めた量と、チャンクの枠57 bytes）以上か。7052×7028では6,071 bytes。
  Web版（iOSのSafariを含む）も同じ共通コードを通る。分析の`operation_failed`の`failure_reason`に`png_canvas`を足し、この失敗をほかと分けて数えられるようにした（`docs/ANALYTICS.md`）。
- 主なファイル: `packages/editor-core/export/exporters.ts`、`packages/editor-core/export/pngErrors.ts`、`packages/editor-core/analyticsFailure.ts`、`docs/ANALYTICS.md`
- テスト:
  - `packages/editor-core/export/exporters.test.ts`: 読み戻しが透明、寸法が違う（1×1）、途中で切れている、PNGでない163 bytes、の4つで`PngCanvasError`になり描画面を縮めること。`pngDimensions`と`minimumPngBytes`。既存の偽のcanvasは、白い読み戻しと寸法の合うPNGを返すようにした（`pngCanvas.test-helper.ts`）。
  - `packages/editor-core/export/exportAnnotations.test.ts`: 偽のcanvasを同様に更新。
  - `packages/editor-core/ui/useEditorController.test.tsx`: 確保に失敗したときは保存画面へ渡さず、案内を出し、`png_canvas`で記録すること。
  - `packages/editor-core/analyticsFailure.test.ts`: `PngCanvasError`を`png_canvas`に分類すること。
  - `tests/e2e/editor.spec.ts`: `toBlob`が163 bytesを返すブラウザで、案内が出てダウンロードされないこと（Chromium・WebKit）。
- 検証:
  - 実機のiPhone 13 mini（iOS 27.2、有線、Debugビルド）で、コミットしない調査用の変更を入れて確かめた。
    - 描画面の確保だけを試すと、2048²〜8192²px（7052×7028を含む）はどれも確保でき、右下の画素も読み戻せた。
    - 1000×1000の盤面で`renderPng`を1セル2〜7pxで作ると、どれも正しい大きさになった（7pxで19,249,226 bytes）。100×100・24pxも同様。
    - 計測用の1000×1000の編み図を開き、メニューのPNG保存（`exportPng`）をJavaScriptから3回送った。どれも7052×7028で19,249,226 bytesがSwiftへ届き、左上の画素も読めた。163 bytesは再現しなかった。
    - 計測と同じUIテスト`testBridgeIOOnRealDevice`で再現を試したが、端末の自動操作の許可の確認に応答がなく「Timed out while enabling automation mode」で2回とも始まらなかった。計測の時の163 bytesのファイルは一時ファイルで、保存画面を閉じたときに消えており、中身は見られなかった。
    - この変更を入れたビルドで、同じ編み図のPNG保存を2回送った。左上は`255,255,255,255`、IHDRは7052×7028、大きさは19,249,226 bytes（最小6,071 bytes）で、検査を通って保存画面まで進んだ。正常な画像を誤って拒否しないことは確かめたが、確保に失敗した実際の場面でこの検査が働くことは、実機ではまだ確かめていない。
  - `npm run typecheck`: 成功。
  - `npm test`: 成功（77ファイル、979件）。
  - `npm run build`: 成功。
  - `npm run check:dist`: 成功。
  - iOS Web: `../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`と`../../node_modules/.bin/vitest run --config vite.config.ts`（`ios/Web`で実行）: 成功（17ファイル、145件）。
  - `npm run test:e2e`: 成功（545件、7件スキップ）。追加したテストはこの実行の開始後に書いたため、`npx playwright test tests/e2e/editor.spec.ts -g "could not allocate"`で別に流して成功（chromium-desktop・chromium-mobile・webkit-mobile）。
  - iOSのUIテストとFull iOS validationは、PRのCIと結合後の実行に任せる。
- デプロイ影響: Pagesへ配信される（共通コードの変更）。iOSアプリは次のビルドから。配信後は、通常の盤面のPNG保存がこれまでどおり保存できることを確かめる。
