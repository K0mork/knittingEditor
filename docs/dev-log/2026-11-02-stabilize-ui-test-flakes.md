# 2026-11-02 — iOS UIテストの一時的な問い合わせ失敗と入力先のずれに対処

- 影響: #44。ガイドのスクロール中に`isHittable`が押す位置を決められない場合は、まだ押せないとして待機を続ける。「Failed to determine hittability」と「Activation point invalid and no suggested hit points based on element frame」の両方に一致する失敗だけを想定内とし、ほかの失敗と最後の到達確認は残す。既存の待機中断ヘルパーと想定内失敗の処理を共通化し、該当する失敗が出た問い合わせの戻り値は使わない。
  「出力」の単発タップ後にパネルを待っていた箇所は、既存の`openSavePanel`へ揃える。10秒待って目的の要素も「閉じる」も無いときだけ1回押し直す。
  キーボードテストは、保存アラートのキャンセル後に盤面を変えない見出しをタップしてから次のショートカットを送る。run 41401344226の失敗した反復では、06:49:22 UTCにアプリから`keyboardFocus`が外され、続く8回のキーはSpringBoardの`SBMainSwitcherWindow`へ配送されていた。アプリ側のキー受信とJavaScript実行はその間に記録されていない。OS側が入力先を切り替えた理由と、この対処による再発防止は未確認のため、失敗時には従来の画面写真に加えて時刻・キー・修飾キー・試行数・アプリ状態・PIDを含む要素の木を残す。アプリコードは変更しない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`ios/UITests/KnittingEditorUITests/KeyboardCommandUITests.swift`
- テスト: `testGuideExternalLinkShowsNoPreview`が使う押せるかの判定、`testBackupExportSheetDismissesBackToEditor`、`measureExport`、PNG上限・横向き出力パネル・アクセシビリティの出力パネル操作、手動可変ウィンドウ検証の出力パネル操作を更新。`testFileAndHelpShortcutsOpenEditorActions`のキャンセル後の操作と、`typeShortcut`の失敗時診断を更新。PR smokeの選択は変更しない。
- 検証:
  - `npm ci --ignore-scripts --offline --cache /private/tmp/ui-flakes-npm-cache`: 成功。ロックファイルの依存関係を使用。Node v26.8.1、Vitest v5.0.5。
  - `node scripts/check-pr-smoke-ui-tests.mjs`: 成功（既存の11件）。
  - `npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`: 成功（16件）。
  - `ios/scripts/check-app-store-docs.sh`: 成功。
  - `git diff --check`: 成功。
  - `xcodebuild build-for-testing -project ios/knittingEditor.xcodeproj -scheme knittingEditor -configuration Debug -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO`（Xcode 27.2、sandboxの外）: `TEST BUILD SUCCEEDED`。sandboxの中では、既存の`@Observable`マクロの起動が`sandbox_apply: Operation not permitted`で止まって失敗した。
  - キャンセル後に叩く見出しは、同じ名前の要素が複数あっても失敗しないよう`firstMatch`にした。
  - 以下のUIテスト3ファイルの型検査は成功（Xcode 27.2 / iOS Simulator 27.2 SDK、実行なし）。既存の`editorAppearanceTimeout`をデフォルト引数で参照する箇所にはMainActorの警告が残る。

    ```sh
    /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swiftc -typecheck -swift-version 5 -target arm64-apple-ios17.0-simulator -sdk /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator27.2.sdk -F /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/Library/Frameworks -I /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/usr/lib -module-cache-path /private/tmp/claude-501/-Users-komorikouki-git-knittingEditor/a31e5bd5-90b2-4917-9bdc-a159105dfa49/scratchpad/codex-dd/ModuleCache.noindex ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift ios/UITests/KnittingEditorUITests/KeyboardCommandUITests.swift ios/UITests/KnittingEditorUITests/SystemSheet.swift
    ```

  - 既存のCIログと`xcresulttool get test-results activities`・`export attachments`・`export diagnostics`を調査。`get log --type console`はログなし。`log show --archive`はsandboxで拒否されたため、抽出済みの`system.logarchive`を`OSLogStore(url:)`で読み、06:49–06:50 UTCの配送先を確認した。
  - 別プロセスがSimulatorを管理しているため、指示に従いローカルのSimulator UIテスト・実機テストは実行していない。PR CIとブランチでのFull iOS validation（iPhone・iPad）へ残す。CI基準のXcode / OSでのコンパイルと、初回成功・再試行なしの継続観察も未確認。Webの全検査はUIテストだけの変更のため未実行。
  - このブランチの`484eb44`でFull iOS validationを手動実行した（run 41424922055）。`ios_full`（iPhone 17・iPad (A16)）、`app_update`（両方）、`release_archive`がすべて成功した。PRのCI（run 41424965889）も`ios`を含めて成功した。
    - 対処した3件は、どれも1回目で成功した。`testGuideExternalLinkShowsNoPreview`はiPhone 17で73.1秒、iPad (A16)で48.4秒。`testBackupExportSheetDismissesBackToEditor`はiPhone 17で46.1秒、iPad (A16)で27.9秒、PRの`ios`で38.3秒。`testFileAndHelpShortcutsOpenEditorActions`はiPad (A16)で119.3秒（iPhoneではハードウェアキーボードのテストとしてスキップ）。
    - ほかの2件が1回目に失敗し、再試行で成功した。今回の変更とは別の箇所で、盤面の記号の数が表示に出るのを待つところで時間切れになった。
      - `app_update (iPhone 17)`の`testSeedDocumentForAppUpdateProbe`（`:839`、124.1秒）
      - `ios_full (iPad (A16))`の`testDocumentSwitchSavesWithoutAutosave`（`saveProbeCanvas`の`:457`、196.7秒）
    - このため、#44の「続けて10回、1回目で成功」はまだ数えられない。
- デプロイ影響: なし（none）。Pages・TestFlight・App Storeのアプリと配布設定は変わらず、配信後確認は不要。コミット・push・PR作成は指示に従い行わない。#44は継続観察が必要なため完了扱いにしない。
