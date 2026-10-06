# 2026-10-07 — iOS版で長押しの文字選択・リンクのプレビュー・画面全体の拡大を抑える

- 影響: iOS版の編集画面で、`WKWebView`由来のWebページ特有の挙動を抑えた（#81）。Simulatorで対策前に試した結果は次のとおり。
  - 見出し・ラベル・ボタン（「保存」）・引き出しの見出しを長押しすると、文字が選択されて「Copy」「Look Up」「Translate」（iPadではさらに「Search Web」「Share…」など）のメニューが出た。
  - ヘッダーの「使い方」リンクを長押しすると、リンクの文字が選択された（プレビューは出なかった）。使い方ページの外部リンク（サポートページ）を長押しすると、リンクのプレビューと「Open Link」「Add to Reading List」「Copy Link」「Share…」のメニューが出た。
  - 見出しやツールバーでピンチすると画面全体が拡大され、「保存」ボタンが約2倍になって画面外へ出た。ダブルタップでは拡大されなかった。
  - 編み図名の入力欄では、ダブルタップ・長押しで「Cut」「Copy」「Paste」などが出た（残すべき挙動）。

  対策として、`WKWebView.allowsLinkPreview`を`false`にし、iOS版のCSSで`body`の文字選択と長押しのメニュー（`user-select`・`-webkit-touch-callout`）を止めて入力欄（`input`・`textarea`）だけ元に戻し、iOS版の`index.html`のviewportを`maximum-scale=1, user-scalable=no`にした。対策後は、見出し・ラベル・ボタン・リンクを長押ししても文字選択とメニューが出ず、外部リンクの長押しでもプレビューが出ない（リンクの文字が選択されるだけで、Safariは開かない）。ピンチ・ダブルタップで画面は拡大されない。入力欄ではダブルタップで「Cut」「Copy」「Paste」などが出て、選択・コピーできる。盤面のピンチ（盤面の拡大）は従来どおり。Web版には入れない（ブラウザでは文字選択と拡大を残すのが自然なため）。iOS版の使い方ページは読み物でDynamic Typeに追従しないので、文字選択とピンチでの拡大を残した。決めた内容は`ios/docs/WEB_SYNC.md`に書いた。
- 主なファイル: `ios/App/WebViewContainer.swift`、`ios/Web/src/styles.css`、`ios/Web/index.html`、`ios/docs/WEB_SYNC.md`
- テスト: XCUITestに`testEditorChromeIgnoresPageZoomAndTextSelection`（見出しとツールバーのピンチ、見出しのダブルタップで見出しと「保存」の位置・大きさが変わらないこと、見出し・ラベル・リンク・ボタンの長押しでメニューが出ないこと）と`testGuideExternalLinkShowsNoPreview`（使い方ページの外部リンクの長押しでプレビューが出ず、アプリが前面のままであること）を足した。`testDocumentDialogRemainsUsableAfterFocusingInput`に、入力欄のダブルタップで選択・コピーのメニューが出ることの確認を足した。いずれの確認方法も、対策前のアプリで同じ操作をしたときに挙動を検出できることを、調査用の一時テスト（コミットしない）で確かめた。iOS Webのテストに、viewportの設定を確かめる`ios/Web/src/webViewBehaviors.test.ts`を足した。
- 検証: 手元で実行したもの。
  - `xcodegen generate`、アプリとテストのビルド（Xcode 27.0）。
  - 対策前の観察: iPhone 18 Pro（iOS 27.0）とiPad 10（iOS 18.2）のSimulatorで、上の操作を調査用の一時テストで行い、画面とアクセシビリティツリーを記録した。対策後も同じ操作をiPad 10で行った。
  - 足したテストと`testDocumentDialogRemainsUsableAfterFocusingInput`を、iPhone 16（iOS 18.2）とiPad 10（iOS 18.2）のSimulatorで実行し、すべて成功した。iPad 10では、関係する既存のテスト（`testGuideNavigationReturnsToUsableEditor`、`testTwoFingerGestureDoesNotDrawOnBoard`、`testPromptDialogIgnoresBackgroundTaps`、`testUndoAndRedoRestoreBoardEdits`、`testAccessibilityExtraExtraExtraLargeKeepsPrimaryFlowsUsable`）も成功した。
  - Dynamic Type: 文字サイズを最大のアクセシビリティサイズ（AX XXXL）にして、iPhone 16とiPad 10で編集画面と入力ダイアログの文字が大きく表示されることをスクリーンショットで確かめた。端末の「ズーム」（アクセシビリティの拡大表示）はシステムの機能でviewportの影響を受けないが、Simulatorでは試していない。
  - iOS Webの`tsc -p tsconfig.app.json --noEmit`と`vitest run --config vite.config.ts`（9件成功）、ルートの`npm run typecheck`と`npm test`（159件成功）。
  - Web版のファイルと共通コードを変えていないので、`npm run build`、`npm run check:dist`、`npm run test:e2e`は実行していない。iOSのSimulatorのテスト一式、アプリ更新テスト、Release Archive、同梱物検査はPRのCIに任せた。
  - 実機では確かめていない。
- デプロイ影響: Pagesへの配信はない（iOS版だけの変更）。次のTestFlight・App Storeのビルドに入る。実機で、見出し・ボタンの長押し、盤面の外のピンチ、編み図名の入力欄での選択・コピーを確かめる。
