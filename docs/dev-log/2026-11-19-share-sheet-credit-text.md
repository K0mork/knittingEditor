# 2026-11-19 — iOSの共有シートにサイト名とURLの文面を添える

- 影響: iOSアプリの共有シートが、共有項目へ文面「棒針編み図エディタで作成 https://knittingeditor.com/」を添える（#474）。メール・メッセージ・ほかの共有機能へは文面が渡り、メールの件名はサイト名「棒針編み図エディタ」になる。「ファイルに保存」・AirDrop・写真への保存・コピー・プリントのようなファイルをそのまま扱う操作へは`ShareCreditItemSource`が文面を渡さないので、保存・送信される項目は変わらない。Web版は変更しない（iOS SafariのWeb Share APIでは文面が全操作へ独立した項目として渡り、「ファイルに保存」が余分なテキストを保存しかねないため）。
- 主なファイル: `ios/App/ShareCreditItemSource.swift`（新規）、`ios/App/WebViewContainer.swift`、`ios/Tests/KnittingEditorAppTests/ShareCreditItemSourceTests.swift`（新規）、`ios/knittingEditor.xcodeproj/project.pbxproj`、`ios/SPECIFICATION.md`、`docs/WEB_SYNC.md`
- テスト: `ShareCreditItemSourceTests`で、文面がサイト名とURLだけであること、メール・メッセージ・外部の共有機能が文面を受け取ること、「ファイルに保存」2種（rawValueの部分一致）を含むファイルをそのまま扱う操作が`nil`を受け取ること、種類が定まらない要求とプレースホルダーが文面の型を保つこと、メールの件名がサイト名であることを確かめる。
- 検証:
  - `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`が成功した（Web版のソースは`origin/main`と同じ）。
  - `xcodegen generate`で`project.pbxproj`が変わらないことを確かめた。
  - iPhone 17のSimulator（iOS 27.2）で`ShareCreditItemSourceTests`（6件）と、PRのUIスモークにある`KnittingEditorUITests/testShareSheetsDismissBackToEditor`が成功した。
- デプロイ影響: iOSのみ（次のアプリリリースに含まれる）。Pagesへ配信される成果物は変わらない。実機の共有シートで、メール・メッセージに文面が出てURLが開けること、「ファイルに保存」・AirDrop・写真・コピーでファイルだけが渡ることの確認は #474 に残す。
