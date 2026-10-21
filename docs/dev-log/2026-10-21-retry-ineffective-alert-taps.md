# 2026-10-21 — 書き出しの確認アラートで効かなかったタップだけ押し直す

- 影響: iOS UIテストの断続的な1回目失敗への対処。アプリの動作は変えていない。
  - main `1ddab5c` の Full iOS validation（run 39528108107）の iPad (A16) で、`testShareSheetStaysUsableAfterRotatingWhileOpen` が1回目に失敗し、再試行で成功した。xcresult・録画・Simulatorのシステムログで調べた。「PNGを保存」の確認アラートで「共有」を押したタップは、ボタンの中心（410,632）に届き、押す・離すのイベントもウィンドウに届いていたが、アラートの操作として成立しなかった。アラートは消えず、共有シートは開かなかった（`_alertControllerWillDisappear`も`UIActivityViewController`の生成も無かった）。アラートの表示からタップまでは1.5秒あり、表示の途中で押したのではない。`:1121`以降の9件の失敗は、共有シートが無いまま続いた巻き添えで、回転後の共有シートの位置（`WebViewContainer.swift`）は一度も呼ばれていない。CIの遅いSimulatorで合成した入力が効かない型とみている。UIKitの中で成立しなかった理由は特定できていない。2026-10-14の手動確認でも、Macの負荷が高いときに「共有」が1回では反応しなかった記録がある（`2026-10-14-ipad-share-sheet-anchor.md`）。
  - 書き出しの確認アラートのボタン（「共有」「ファイルに保存」）を押す補助処理`tapExportAlertButton`を足した。静止を待って押し、8秒でアラートが消えなければ、ボタンがまだ押せるときだけ画面写真を添付して1回押し直す。さらに15秒待っても消えなければ失敗にして、呼び出し元が後の確認を打ち切る。
  - 使う場所: `testShareSheetStaysUsableAfterRotatingWhileOpen`と`assertShareSheetsDismissBackToEditor`の「共有」、`testBlockSaveAndFullBackupRestoreFollowGuide`と`testBackupExportSheetDismissesBackToEditor`の「ファイルに保存」。`testShareSheetStaysUsableAfterRotatingWhileOpen`は、共有シートが開かなければ、その場で1件の失敗として打ち切る。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 上の4か所を更新した。テストケースの追加・削除は無く、PRスモークの選択は変えていない（`node scripts/check-pr-smoke-ui-tests.mjs`成功）。
- 検証: 手元（Xcode 27.1）で`xcodebuild build-for-testing`（iOS Simulator）が成功した。KE verify iPad（iOS 27.0、Simulatorは1台だけ）で`testShareSheetStaysUsableAfterRotatingWhileOpen`（48.5秒）と`testBackupExportSheetDismissesBackToEditor`（33.7秒）が成功した。押し直しの経路は通らなかった。`testBlockSaveAndFullBackupRestoreFollowGuide`、`assertShareSheetsDismissBackToEditor`を使うテスト、iPhoneでの実行は、PRの`ios`ジョブと、このブランチで手動実行する`ios-full.yml`に任せる。
- デプロイ影響: なし。iOSのUIテストだけで、Pagesの配信物もアプリも変わらない。
