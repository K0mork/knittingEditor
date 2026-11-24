# 2026-11-24 — iOSのUIテストの重複とiPhone横向きの組み合わせを減らす

- 影響: テストだけの変更で、アプリの動作は変わらない。Full iOS validationで最も長いiPadのジョブを短くする。
  - 共有シートはどの書き出し形式も同じ`UIActivityViewController`なので、`testShareSheetsDismissBackToEditor`は`PNGを保存`だけで確かめる。4形式のネイティブ操作へ届くことは`testBackslashDocumentNameReachesAllNativeExportActions`、バックアップの保存シートは`testBackupExportSheetDismissesBackToEditor`が確かめる。
  - iPhoneの横向きは基本の操作（`testPrimaryControlsRemainUsableInPortraitAndLandscape`）だけを確かめる。横向きの共有シート・名前入力とキーボード・出力パネルの右列は、横向きが普通のiPadでだけ確かめる。共有シートを開いたまま回転させる`testShareSheetStaysUsableAfterRotatingWhileOpen`は削除した。
  - 端末の形に依存しない保存・復元・ジェスチャーのテスト6件は、iPhoneでだけ実行する。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト:
  - iPhoneでスキップ: `testShareSheetsDismissBackToEditorInLandscape`、`testNameDialogButtonsStayAboveKeyboardInLandscape`、`testLandscapeExportPanelUsesRightColumn`
  - iPadでスキップ: `testBlockSaveAndFullBackupRestoreFollowGuide`、`testDocumentSwitchSavesWithoutAutosave`、`testHomeSavesWithoutAutosave`、`testOversizedPngExplainsLimitAndDisablesSave`、`testEditAndRelaunchRestoresLocalDocument`、`testTwoFingerGestureDoesNotDrawOnBoard`
  - `testShareSheetsDismissBackToEditor`は1形式になったので、実行時間の上限の上書き（240秒）を外した。
- 検証: `node scripts/check-pr-smoke-ui-tests.mjs`、`npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`、`xcrun swiftc -frontend -parse`（構文のみ）が成功した。ビルドとiPhone 17・iPad (A16)での実行は、PRのCIとブランチで手動実行したFull iOS validationで確かめる。
- デプロイ影響: なし。
