# 2026-10-15 — 文字サイズ最大のUIテストで、編集画面の準備が終わるのを待つ

- 影響: アプリの動作は変えていない。文字サイズ最大（アクセシビリティXXXL）で起動するUIテスト3件（`testAccessibilityExtraExtraExtraLarge…`）は、起動後に`app.webViews.firstMatch`が現れた時点でWebの内容（「編み図」ボタンなど）を探し始めていた。WKWebViewは、ネイティブの準備中の表示（`editorLoadingOverlay`、「編み図を準備しています…」）の下で最初から存在するので、この時点ではページがまだ`webReady`を送っていないことがある。#64で記録された2つの失敗は、どちらも起動直後のこの区間で起きていた。iOS 27.0の新しいSimulatorを負荷のある状態で使ったときに、45秒たっても準備中の表示のままだった件と、CI（iOS 26.5）で、WebViewが見つかった直後の最初の問い合わせが約55秒応答せず`Timed out while evaluating UI query`になった件である。今回の実行でも、WebViewが見つかった直後に`Ignoring failure to get hierarchy for remote element … kAXErrorServerNotFound`が記録された。WebContentプロセスのアクセシビリティがまだ応答できない間に、問い合わせを始めていた。このため`launchWithAccessibilityExtraExtraExtraLarge()`で、`KeyboardCommandUITests`と同じように準備中の表示が消える（`webReady`が届く）のを待ってから、Webの内容を探すようにした。待つ上限は従来の`editorAppearanceTimeout`（45秒）のままで、確かめる内容と時間の上限は緩めていない。
  - アプリの不具合ではないと判断した理由: iPhone 17実機（iOS 27.0）では2026-10-09に3件×3回が成功している（PR #150）。今回のiOS 27.0のSimulatorでは、変更前のテストで計24回（何もしない状態で15回、Playwrightを同時に流した負荷のある状態で9回）流して、1度も止まらなかった。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 上の待ちを足した（テストの修正だけ）。
- 検証:
  - 変更前（`main`の`4eef16b`）。新しく作ったiPhone 17・iOS 27.0のSimulator（Xcode 27.0）で`xcodebuild test-without-building … -test-iterations 5 -only-testing:<3件>`を実行し、15回すべて成功した。新しい端末の最初の1回は107秒かかり、その後は19〜57秒だった。続けて、`npm run test:e2e`を同時に流しながら`-test-iterations 3`で実行し、9回すべて成功した（同時に流したE2Eは444件成功）。
  - 変更後。同じiOS 27.0のSimulatorで`-test-iterations 5`を実行し、15回すべて成功した（1回あたり18〜51秒）。CIと同じiPhone 17・iOS 26.5のSimulator（KE verify iPhone）でも`-test-iterations 3`を実行し、9回すべて成功した。どちらも再試行なしで実行した。
  - `git diff --check`が成功した。Web・共通コードは変えていないので、Webのテストは手元で実行していない。PR CIのiPhoneのUIスモーク（文字サイズ最大の1件を含む）と、Full iOS validation（iPhone・iPad）で確かめる。
  - 同じPRで、`docs/dev-log/2026-10-15-ipad-trackpad-zoom.md`の誤りを直した。手元で単体テストとキーボード操作のUIテストを流したSimulatorを「iOS 27.0」と書いていたが、実際は「KE verify iPad」（iPad (A16)、iOS 26.5）だった。版の表記だけを直し、実行した内容と結果は変わらない。
- デプロイ影響: なし（UIテストと文書だけ）。
