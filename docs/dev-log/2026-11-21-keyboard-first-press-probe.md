# 2026-11-21 — ショートカットが最初の1回で効くかを測るUIテスト

- 影響: iPadのハードウェアキーボードで⌘Oなどが最初の1回で効くかを、SimulatorのXCUITestで測れるようにした（#303）。テストは環境変数があるときだけ動き、結果を`FIRST_PRESS`の行と`XCTAttachment`に残す。1回目で反応しないときだけ2回目を送り、2回とも反応しなければ失敗する。100%でなくても成功する。アプリの動作は変えていない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KeyboardCommandUITests.swift`
- テスト: `KeyboardCommandUITests/testShortcutsTakeEffectOnFirstPress`を追加した。起動直後と、記号を3個置いて「盤面」パネルを開閉した後の2つの状況で、⌘O・⌘N・⌘S・⌥⌘S・⇧⌘E・⌘P・⌘Z・⇧⌘Z・⇧⌘Hを1回だけ押して測る。計測回数は`KNITTING_EDITOR_KEYBOARD_FIRST_PRESS_RUNS`（既定5）。編集画面が準備できてから最初のキーまで1.0秒待つ。
- 検証:
  - KE verify iPad（iPad (A16)、iOS 27.2、Xcode 27.2）で、`TEST_RUNNER_KNITTING_EDITOR_KEYBOARD_FIRST_PRESS=1`と`TEST_RUNNER_KNITTING_EDITOR_KEYBOARD_FIRST_PRESS_RUNS=10`を付けて`xcodebuild test -only-testing:knittingEditorUITests/KeyboardCommandUITests/testShortcutsTakeEffectOnFirstPress`を実行し、成功した。10回とも、2つの状況の9つのショートカットすべてが1回目で効いた。
  - その前の5回の実行では、1回目の起動直後の⌘Oだけが2回目で効き、4回目に⌘Oで開いた選択画面を閉じられないまま⌘Nを送ってテストが失敗した。選択画面を閉じるまで3回まで試し、閉じられなければ失敗にするよう直した。起動直後の⌘Oは、2回の実行を合わせて14回中13回が1回目で効いた。
  - `xcrun --sdk iphonesimulator swiftc -typecheck`（成功。既存のmain actor警告のみ）、`git diff --check`、`node scripts/check-pr-smoke-ui-tests.mjs`、`npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`が成功した。
  - SimulatorのキーはXCTestが合成したもので、実機のハードウェアキーボードでの確認ではない。実機での確認は#501に移した。
- デプロイ影響: なし。TestFlight・App Storeへの影響もなし（テストのみ）。
