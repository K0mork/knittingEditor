# 2026-11-04 — iOS UIテストで、効かなかった盤面のタップと「元に戻す」を押し直し、経過を残す（#375）

- 影響: Full iOS validation（run 41424922055、`484eb44`）で1回目に失敗した2件を、ジョブログと失敗時の要素の木から調べた。どちらも、合成したタップのあと記号数が変わらず時間切れになっていた。Issueには「記号0個」を待つところとあったが、`testSeedDocumentForAppUpdateProbe`（当時の`:839`）は、記号0個の盤面を見つけて中央をタップしたあと「記号1個」を待つところだった。
  - `app_update (iPhone 17)`の`testSeedDocumentForAppUpdateProbe`: 名前のダイアログが閉じた約2秒後に盤面の中央をタップした。60秒後も盤面は「記号0個」、「元に戻す」は無効のままで、ダイアログや別の画面は残っていなかった。タップが編集として届いていない。
  - `ios_full (iPad (A16))`の`testDocumentSwitchSavesWithoutAutosave`: 消去モードでマスを消し（記号0個になった）、約1秒後に「元に戻す」をタップした。45秒後も「記号0個」のままで、「元に戻す」は有効だった。xcresultに残った合成イベントでは、タップの位置は(769, 381)で、「元に戻す」の枠`{{725, 359}, {87, 44}}`の中央に当たっていた。正しい位置へ届いた、有効なボタンのタップが効いていない。
  - どちらもアプリの処理（描画・履歴）には、タップが届けば記号数が変わらない経路が見つからなかった。#44で記録した「編み図」「出力」の最初のタップが効かない現象と同じく、合成したタップがWebViewで効かなかった形と判断した。なぜ効かないのかは分かっていない。
  - テスト側で、10秒たっても元の記号数のままのときだけ同じ操作を1回押し直す`tapChangingStitchCount`を足し、上の2か所で使う。押し直すのは、遅れて2回効いても結果が変わらない操作に限る（同じマスへの描画、履歴が直前の消去1件だけのときの「元に戻す」）。「元に戻す」は有効なときだけ押し直す。
  - 押し直したときと最後まで変わらなかったときは、各操作の時刻を`TAPRETRY`で始まる行としてジョブログとテストの記録に出し、画面写真を残す。押し直しで通っても直ったとはせず、#44の観察でこの行の有無を数える。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: `testSeedDocumentForAppUpdateProbe`と`testDocumentSwitchSavesWithoutAutosave`（`assertSaveProbePosition`）の待ち方を変えた。新しいテストは足していない。
- 検証: 手元（Xcode 27.2、iOS 27.2のSimulator。CIはXcode 26.6）で次を実行した。
  - `node scripts/check-pr-smoke-ui-tests.mjs`: 成功（PRのスモーク一覧は変えていない。2件とも一覧の外で、PRのCIでは走らない）
  - `xcodebuild test ... -only-testing:knittingEditorUITests/KnittingEditorUITests/testDocumentSwitchSavesWithoutAutosave`（iPad (A16)）: 1回目は失敗した。Spotlightの索引作成でMacの負荷（load average）が150〜200になり、要素の検索1回に十数秒かかって、盤面の静止の確認（`:379`、今回変えていない箇所）が10秒で終わらなかった。負荷が下がってから実行し直して成功（171秒、`TAPRETRY`の行なし）
  - `SIMULATOR_UDID=<iPhone 17> ios/scripts/simulate-app-update.sh "iPhone 17"`: 成功（`testSeedDocumentForAppUpdateProbe`、`testUpdatedAppRestoresSeedDocument`。`TAPRETRY`の行なし）
  - Web・共有コードは変えていないので、`npm run typecheck`などWebの検査は実行していない。
  - PRのCIと、ブランチで手動実行するFull iOS validation（iPhone 17・iPad (A16)）で2件が1回目に成功することを確かめる（#375の完了条件）。
- デプロイ影響: なし（UIテストだけの変更。Pages・TestFlight・App Storeへの影響なし）
