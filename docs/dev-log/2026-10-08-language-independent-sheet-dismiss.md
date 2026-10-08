# 2026-10-08 — iOS UIテストでシステムシートを端末の言語に依存せず探す

- 影響: iOSのUIテストだけが変わる（#127）。アプリとWeb版の動きは変わらない。
  - #119でアプリがローカライズ（`InfoPlist.xcstrings`）を持つと、Document Pickerなどのシステムシートの閉じるボタンからidentifier `Cancel`が無くなり、labelが端末の言語の「Cancel」「キャンセル」になった。`testBackupExportSheetDismissesBackToEditor`と補助関数`dismissSystemSheet`はidentifier・label `Cancel`でシートを探していたため、日本語のSimulatorではシートを見つけられずに失敗していた（CIではこのテストをスキップしている）。
  - #125で`KeyboardCommandUITests.testRestoreShortcutOpensBackupPicker`に入れた判定（identifier `Cancel`・`Browse View (Picker)`か、label「Cancel」「キャンセル」）を共通の`SystemSheet`にまとめ、3か所から使うようにした。閉じるボタンは、identifier `Cancel`か、label「Cancel」「キャンセル」のボタンで探す。
  - アプリの確認ダイアログ（「ファイルに保存」「共有」）にも「キャンセル」ボタンがあるため、`testBackupExportSheetDismissesBackToEditor`では「ファイルに保存」を押したあと、ダイアログが消えてから保存シートを探すようにした。
- 主なファイル: `ios/UITests/KnittingEditorUITests/SystemSheet.swift`（新規）、`ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`ios/UITests/KnittingEditorUITests/KeyboardCommandUITests.swift`、`ios/knittingEditor.xcodeproj/project.pbxproj`（`xcodegen generate`で再生成）
- テスト: 上の2つのUIテストを`SystemSheet`を使う形に更新した。
- 検証:
  - `xcodegen generate --spec ios/project.yml`のあと、`xcodebuild build-for-testing`（`-destination "generic/platform=iOS Simulator"`、`CODE_SIGNING_ALLOWED=NO`、成功）。
  - 変更前: iPad Pro 11-inch（M5）・iOS 27.0のSimulator（Xcode 27.0）で`-testLanguage ja -testRegion JP`を付けて実行し、`testBackupExportSheetDismissesBackToEditor`が保存シートを見つけられずに失敗することを確かめた（シートの閉じるボタンはlabel「キャンセル」のボタンで、identifierは無かった）。
  - 変更後: iPhone 18 Pro・iPad Pro 11-inch（M5）（どちらもiOS 27.0）のSimulatorで、`xcodebuild test-without-building`に`-only-testing:knittingEditorUITests/KnittingEditorUITests/testBackupExportSheetDismissesBackToEditor`と`-only-testing:knittingEditorUITests/KeyboardCommandUITests/testRestoreShortcutOpensBackupPicker`を付け、`-testLanguage ja -testRegion JP`と`-testLanguage en -testRegion US`でそれぞれ実行した。
    - 日本語: iPhoneは`testBackupExportSheetDismissesBackToEditor`が成功（`testRestoreShortcutOpensBackupPicker`はiPad専用のため既存の条件でスキップ）、iPadは2件とも成功。
    - 英語: iPhoneは`testBackupExportSheetDismissesBackToEditor`が成功（`testRestoreShortcutOpensBackupPicker`は同じくスキップ）、iPadは2件とも成功。
  - `dismissSystemSheet`を使うのは`testBackupExportSheetDismissesBackToEditor`だけである。
  - Simulatorのテスト一式、更新復元、Release Archive、オフラインbundle検査はPRのCIに任せた。iOS Webのコードは変えていないため、iOS Webの型検査・テストと、Web版の確認（`npm run typecheck`など）は手元で実行していない。
- デプロイ影響: なし（テストだけの変更で、Pagesにもアプリにも入らない）。
