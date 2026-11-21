# 2026-11-21 — WebContent終了中のシートとVoiceOverのUIテスト

- 影響: #336の残りの確認のうち、共有シート・保存画面の表示中にWebContentプロセスが終了したときの復帰、VoiceOverで準備中の表示・案内・「再試行」を読み上げて操作できること、大きな編み図をバックグラウンドへ移して戻したときの復帰を、SimulatorのUIテストで確かめられるようにする。アプリの挙動は変えない。
  - 終了はテストから起こせないため、`ios/scripts/run-webcontent-termination-ui-test.sh`がテストの`NSLog`の合図で、対象Simulatorの`launchd_sim`の子プロセスである`com.apple.WebKit.WebContent`をSIGKILLする。テストは`TEST_RUNNER_KNITTING_EDITOR_WEBCONTENT_KILL=1`があるときだけ動作し、CIではskipする。
  - 終了時に`WebViewContainer.Coordinator.webViewWebContentProcessDidTerminate`は`documentID`を更新して`pendingExport.requestID`を捨て、`didCommit`でも同じIDを捨てる。`ExportSession.finish`は`requestID`が無い結果を返さず、Web側の`pendingExports`もページの読み直しで消えるため、再読み込み後のページに古い書き出しの結果は届かない。この境界は既存の`WebContentRecoveryTests`と`NativeExportResultTests`が検証している（今回は実行していない）。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`ios/scripts/run-webcontent-termination-ui-test.sh`、`ios/DEVELOPMENT.md`。
- テスト: `testShareSheetSurvivesWebContentTermination`、`testDocumentPickerSurvivesWebContentTermination`、`testRecoveryAccessibilityExposesPreparingNoticeAndRetry`、`testLargeChartRecoversFromWebContentTerminationInBackground`を追加。共有シート・保存画面を閉じたあとに保存済みの編み図が残り、さらに1個描いて編集を再開できること、古い書き出しの失敗案内が出ないこと、準備中・失敗案内・「再試行」の読み上げ用ラベルとボタンの種類、失敗案内の画面の`performAccessibilityAudit`（ラベルと種類のみ）を確かめる。
- 検証:
  - KE verify iPhone（iPhone 17、iOS 27.2、Xcode 27.2）で`ios/scripts/run-webcontent-termination-ui-test.sh "KE verify iPhone"`を実行し、4件とも1回目で成功した。
  - 途中で見つけて直したテストの問題:
    - 共有シートの枠外のタップは、シートを閉じると同時に背後の要素にも届いた。再読み込みで出力パネルが消えると枠外は盤面になり、記号が1個増えた。下へのドラッグでは共有シートは閉じなかったため、ヘッダーの題名を叩いて閉じる。
    - 保存画面のテストの編み図名が「保存中」を含み、保存状態の表示の判定に当たっていた。名前を変えた。
    - 再読み込みが速いと準備中の表示は1秒ほどで消え、`waitForExistence`（約1秒ごと）では見落とした。表示の中のラベルを間を空けずに探す。
  - `xcodegen generate --spec ios/project.yml`と、`OTHER_SWIFT_FLAGS='-disable-sandbox'`を付けた`xcodebuild build-for-testing`が成功した（実装した担当のサンドボックスでの確認）。
  - `bash -n ios/scripts/run-webcontent-termination-ui-test.sh`、`node scripts/check-pr-smoke-ui-tests.mjs`、`npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`、`npm test -- scripts/japanese-punctuation.test.mjs`が成功した。
  - 実機では確かめていない。実機でWebContentが終わる原因（メモリ不足など）はSimulatorと違うが、終了後の処理は`webViewWebContentProcessDidTerminate`から始まり、原因によらず同じ。Simulatorでは本物のWebContentプロセスを終了させてこの処理を通した。
- デプロイ影響: なし。テストと手順のみで、アプリの挙動、TestFlight、App Storeの提出物は変わらない。
