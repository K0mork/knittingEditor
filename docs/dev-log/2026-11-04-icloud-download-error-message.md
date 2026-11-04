# 2026-11-04 — iCloudのバックアップ読み込み失敗を通信案内へ対応づける

- 影響: #387。Files・共有と「バックアップから復元」の両経路で、iCloudのダウンロード失敗と判定できた場合は「iCloudからファイルをダウンロードできませんでした。インターネットに接続してから、もう一度お試しください。」と表示する。欠損・権限・不正データ等の区別できない失敗と容量超過は従来の文言を維持する。
- 主なファイル: `ios/App/BackupReadFailure.swift`、`ios/App/WebViewModel.swift`、`ios/App/WebViewContainer.swift`、`ios/Tests/KnittingEditorAppTests/BackupReadFailureTests.swift`、`ios/Tests/KnittingEditorAppTests/NativeErrorDeliveryTests.swift`、`ios/knittingEditor.xcodeproj/project.pbxproj`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`。
- 設計: UIKitに依存しない判定と文言選択を共通化した。`NSUnderlyingErrorKey`と`NSMultipleUnderlyingErrorsKey`を循環検出付きでたどり、深さ32・各ルート128件を上限とする。Files経路はsecurity-scopedアクセスを終了する前に原本のリソース値を調べ、取得できなければエラーだけで判定する。Document Pickerの複製には原本のリソース値を使わない。`BackupRead`カテゴリのシステムログにはdomainとcodeの連鎖だけを公開し、ファイル名・パス・説明や解析通信を追加しない。リソース値の意味は[Appleのダウンロードエラーの文書](https://developer.apple.com/documentation/foundation/urlresourcekey/ubiquitousitemdownloadingerrorkey)とSDKのFoundationヘッダーで確認した。
- テスト: Cocoaの4353・4355と範囲境界、入れ子の-1009、複数原因の-1020、指定の通信エラー、CloudDocs、未ダウンロードとダウンロード済みの原本、リソース値のエラー、欠損・権限・一般エラー、状態が取れない原本、循環・深さ・件数の上限、記録用の値を追加。両経路の文言対応と容量超過の維持は`NativeErrorDeliveryTests`に追加し、既存の欠損ファイル配送テストは維持した。
- 検証（手元）:
  - `xcodegen generate --spec ios/project.yml`: 成功。追加したソースとテストをプロジェクトへ反映した。
  - `xcodebuild test -project ios/knittingEditor.xcodeproj -scheme knittingEditor -destination "platform=iOS Simulator,id=<KE verify iPhone>" -only-testing:knittingEditorTests CODE_SIGNING_ALLOWED=NO`（Xcode 27.2、iPhone 17・iOS 27.2のSimulator）: 成功。152件、失敗0、スキップ1（既存）。追加した12件と、既存の欠損ファイル配送のテストを含む。CIはXcode 26.6のままなので、最終的な判断はCIで行う。
  - `ios/scripts/check-app-store-docs.sh`、`node scripts/check-pr-smoke-ui-tests.mjs`、`git diff --check`: 成功。
  - `packages/`と`ios/Web/`は変えていないので、iOS Webの型検査・テストとWebの検証は実行していない。
- 検証（未実行）:
  - UIテスト、Full iOS validation: PRのCIと、ブランチでの`ios-full.yml`の手動実行に任せる。
  - 実機確認: 未実行。Simulatorはオフラインにできず、iCloudのダウンロード失敗で届くエラーの種類は実機でしか確かめられない。iPhone・iPadで、ダウンロードされていないiCloud Driveの`.knit`を機内モードにして、Filesから開く経路と「バックアップから復元」の経路の両方で開き、表示とConsole.appの`BackupRead`ログを確かめる。Document Pickerが複製を渡す前に失敗する場合に、アプリの`catch`まで届くかも確かめる。M3の実機結果の本文は変えていない。#387はこの確認が終わるまで閉じない。
- デプロイ影響: Pagesはなし。TestFlight／App Storeへ反映するには新しいiOSビルドの配布が必要。署名・配布設定の変更や提出は行っていない。配布後に両経路の通信案内、端末内の欠損・容量超過の従来表示、通常の復元をiPhone・iPadで確認する。
