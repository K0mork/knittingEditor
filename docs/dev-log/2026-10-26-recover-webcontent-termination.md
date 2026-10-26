# 2026-10-26 — WebContent終了後の編集画面の復旧

- 影響: #336のWebContent終了時に「編み図を準備しています…」を表示し、保存領域を変更せず再読み込みする。自動復旧から10秒以内の再終了、準備完了前の連続自動復旧2回超過、読み込み失敗、30秒の復旧待ち超過では、失敗案内と「再試行」を表示する。`webReady`で失敗状態と連続回数を解除し、短時間の再終了を検出する時刻は保持する。
  - 終了時と再試行時は共通の`reloadWebView`を使い、URLがなければ`LocalWebSchemeHandler.indexURL`を読み込む。provisional開始ハンドラは設けず、終了時と`didCommit`で文書ID・書き出し要求IDを無効化し、古い文書からの実行待ちのネイティブ画面表示と結果配送を防ぐ。
  - 未配送のバックアップ・エラーは次の`webReady`まで保留し、配送済み通知は再送しない。表示中の保存・共有画面と一時ファイルは閉じるまで維持する。
- 主なファイル: `ios/App/WebViewContainer.swift`、`ios/App/KnittingEditorApp.swift`、`ios/Tests/KnittingEditorAppTests/NativeErrorDeliveryTests.swift`。
- テスト: `WebContentRecoveryTests`を追加。終了後の復旧、短時間・連続終了の抑止、失敗・タイムアウト・再試行、URLなしの初回失敗後の読み込み、共通の再読み込み経路、非編集ページ、保留通知、終了時・遷移確定時の古い要求の無効化、一時ファイルの保持を検証する。
- 検証:
  - `xcodegen generate --spec ios/project.yml`後、iPhone 17 Simulator（iOS 27.0）で全`bundle.unit-test`ターゲットと`ios/UITests/pr-smoke-ui-tests.txt`のPR UIスモークを`xcodebuild test`で実行。ユニットテストは133件実行、1件スキップ、失敗0件（新規`WebContentRecoveryTests`を含む）。UIスモークは11件、失敗0件。
  - Simulatorで保存済み編み図を開き、`com.apple.WebKit.WebContent`を終了すると「編み図を準備しています…」を経て保存済み編み図を保持した編集画面に戻ることを確認。10秒以内に2回終了すると失敗案内と「再試行」が表示され、タップ後に保存済み編み図へ戻ることを確認。Dark Modeでも失敗画面を確認。
  - `swiftc -frontend -parse ios/App/WebViewContainer.swift ios/App/KnittingEditorApp.swift ios/Tests/KnittingEditorAppTests/NativeErrorDeliveryTests.swift`と`git diff --check`は成功。
  - ローカル未実施・CIへの引き継ぎ: NodeベースのWebチェック（Web・共有コードの変更なし）、iPad、VoiceOver、実機。ブランチ上の`ios-full.yml`手動実行結果は`TODO(lead)`。
- デプロイ影響: Pagesへの影響なし。iOSアプリに反映。#336は`needs-device`のため、大きな編み図、バックグラウンド・フォアグラウンド遷移、共有シート表示中の終了、VoiceOverの実機検証が引き続き必要であり、このPRでは#336を閉じない。
