# 2026-11-21 — ショートカットが最初の1回で効くかを測るUIテスト

- 影響: iPadのハードウェアキーボードで⌘Oなどが最初の1回で効くかを、SimulatorのXCUITestで測れるようにした（#303）。テストは環境変数があるときだけ動き、結果を`FIRST_PRESS`の行と`XCTAttachment`に残す。1回目で反応しないときだけ2回目を送り、2回とも反応しなければ失敗する。100%でなくても成功する。アプリの動作は変えていない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KeyboardCommandUITests.swift`
- テスト: `KeyboardCommandUITests/testShortcutsTakeEffectOnFirstPress`を追加した。起動直後と、記号を3個置いて「盤面」パネルを開閉した後の2つの状況で、⌘O・⌘N・⌘S・⌥⌘S・⇧⌘E・⌘P・⌘Z・⇧⌘Z・⇧⌘Hを1回だけ押して測る。計測回数は`KNITTING_EDITOR_KEYBOARD_FIRST_PRESS_RUNS`（既定5）。起動直後の状況だけ、編集画面が準備できてから最初のキーまで1.0秒待つ。
  - 反応の判定: 書き出しは保存画面のファイル名（`.knit`・`knitting-editor-backup.knit`・`.png`・`.pdf`）まで確かめ、押す前に前の保存画面が残っていないことを確かめる。⌘Z・⇧⌘Zは記号数がちょうど1つ減る・増えることで確かめる。保存の待ちで「保存失敗」が出たら失敗にする。
  - 後片付け: ⌘Oの選択画面、⌘Nのダイアログ、書き出しの保存画面、使い方ページは、それぞれ3回まで閉じる・戻るを試し、できなければ失敗にする。閉じ損ねた画面にキーが吸われて誤った結果になるのを防ぐ。
  - 途中で失敗しても、それまでの集計表と添付を`addTeardownBlock`で残す。添付とログの端末名は、利用者が付けた名前ではなくSimulator名か機種名にした。
- 検証:
  - KE verify iPad（iPad (A16)、iOS 27.2、Xcode 27.2）で、`TEST_RUNNER_KNITTING_EDITOR_KEYBOARD_FIRST_PRESS=1`と`TEST_RUNNER_KNITTING_EDITOR_KEYBOARD_FIRST_PRESS_RUNS=10`を付けて`xcodebuild test -only-testing:knittingEditorUITests/KeyboardCommandUITests/testShortcutsTakeEffectOnFirstPress`を実行し、成功した。最終のコードでの結果は、起動直後の⌘Oが10回中9回1回目で効き（残る1回は2回目で効いた）、そのほかの17の組み合わせは10回とも1回目で効いた。
  - レビューで判定と後片付けを直す前の実行では、5回の実行の1回目で起動直後の⌘Oだけが2回目で効き、4回目に⌘Oで開いた選択画面を閉じられないまま⌘Nを送って失敗した。続く10回の実行では、すべてが1回目で効いた。起動直後の⌘Oは、3回の実行を合わせて24回中22回が1回目で効いた。
  - `xcrun --sdk iphonesimulator swiftc -typecheck`（成功。既存のmain actor警告のみ）、`git diff --check`、`node scripts/check-pr-smoke-ui-tests.mjs`、`npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`が成功した。
  - SimulatorのキーはXCTestが合成したもので、実機のハードウェアキーボードでの確認ではない。実機での確認は#501に移した。
  - 追加したUIテストは環境変数が無いとskipするため、`ios-full.yml`のブランチでの実行は行わない。
- デプロイ影響: なし。TestFlight・App Storeへの影響もなし（テストのみ）。
