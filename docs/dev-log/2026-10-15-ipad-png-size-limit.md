# 2026-10-15 — iPad実機でPNGの上限超過の表示を確かめ、UIテストにする

- 影響: アプリの動作は変えていない。1000×1000の盤面でPNGの1セルの画素数を最大の60pxにしたときに、上限を超える理由とPDF保存のすすめが出て「PNGを保存」が押せなくなることを、iPad実機で確かめた（#24）。iPhone 17では2026-10-09に手で確かめてあり、iPadが残っていた。手順をUIテストにしたので、`ios-full.yml`のiPhone・iPadでも毎回確かめる。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`
- テスト: XCUITest `testOversizedPngExplainsLimitAndDisablesSave`を追加した。新しい編み図を1000×1000にし、出力パネルの「1セルの画素数」を60pxまでドラッグして、「一辺が上限16384pxを超えます」と「この盤面はPDF保存をおすすめします。」が出ること、「PNGを保存」が押せないこと、アプリが前面で動いていることを確かめる。2pxへ戻すと両方の表示が消え、「PNGを保存」が押せるようになることも確かめる。WebViewのスライダーは`adjust(toNormalizedSliderPosition:)`で動かせない（つまみの位置の属性が0のまま返る）ため、今の値からつまみの位置を求めてドラッグする。今の値は、スライダーの名前（「1セルの画素数 7px」）から読む。横の値の表示は、iOS 26.5のWebKitでは「7」と「px」に分かれるため使わない。PRのUIスモーク一覧には加えていない。
- 検証: Xcode 27.0で`xcodegen generate`のあと、`xcodebuild test -only-testing:knittingEditorUITests/KnittingEditorUITests/testOversizedPngExplainsLimitAndDisablesSave`を次の端末で実行した。
  - iPad Air 第5世代（iPadOS 27.0.1、有線、無料Personal Teamで署名、`DEVELOPMENT_TEAM`はコマンドで指定）: 成功（47.3秒）。
  - iPhone 17 Simulator（iOS 26.5、`CODE_SIGNING_ALLOWED=NO`）: 成功（38.4秒）。
  - iPad (A16) Simulator（iOS 26.5、`CODE_SIGNING_ALLOWED=NO`）: 成功（58.8秒）。
  - 値の読み方を直す前の版は、iPad実機で成功し、画面写真で右側の出力パネルに「60120×60120px — 一辺が上限16384pxを超えます」、押せない「PNGを保存」、「この盤面はPDF保存をおすすめします。」が出ていることを確かめた。同じ版は、iOS 26.5のSimulatorではiPhone・iPadとも、値を読めずにスライダーを動かさないまま失敗した。
  - `node scripts/check-pr-smoke-ui-tests.mjs`と`git diff --check`が成功した。
  - Webと共有コードは変えていないため、Webの確認（`npm run typecheck`など）は実行していない。ほかのUIテストと単体テストは、PRのCIと`ios-full.yml`に任せる。
- デプロイ影響: なし（テストと文書だけ）。iOSアプリの動作も変わらない。
