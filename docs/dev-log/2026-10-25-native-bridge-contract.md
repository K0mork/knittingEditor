# 2026-10-25 — ネイティブブリッジ契約とオフライン試験の回帰保護

- 影響: SwiftとTypeScriptのコマンド・イベント・送信メッセージ名・ハンドラー名の不一致をiOS WebのPR検証で検出する。アプリの実行時挙動・保存形式・画面の変更はない。
- 主なファイル: `ios/Web/src/nativeBridge.contract.test.ts`、`ios/Tests/KnittingEditorAppTests/LocalWebSchemeHandlerTests.swift`
- テスト: 両実装のソースを直接読む契約テスト3件を追加。通信確認はCanvasの出現を最大15秒待ち、プローブ配列の存在を明示的に確認する。機内モードの手動試験も同じ待機処理を使用する。通信履歴の空配列は正常だが、未注入を空配列で代替しない。
- 検証環境: ローカルNodeは26.8.1、CIはNode 24。
- 検証:
  - `npm run typecheck`: 成功。
  - `npm test`: 初回は70ファイル成功・1ファイル失敗、782テスト成功・1テスト失敗。既存のPDF密盤面の生成時間が17.68秒で15秒の制限超過。再実行は71ファイル・783テストすべて成功（17.38秒）。
  - `npm run build`、`npm run check:dist`: 最終実行は成功（`built in 484ms`、`dist verified: 2637.2 KiB`）。途中の重複ビルドではCSP重複／未挿入エラーが発生したため、終了を確認して順次再実行した。
  - `cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts src/nativeBridge.contract.test.ts`: 3テスト成功。
  - `cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: 最終実行成功。初期案のNode型定義参照エラーを`?raw`読込みへの変更で解消。
  - `cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts`: 最終実行17ファイル・142テスト成功。
  - Swift用SDKは `xcrun --sdk iphonesimulator --show-sdk-path` で確認。次のコマンドは環境エラーで失敗（Observationマクロ実行不能、XCTestを解決できない）。Simulatorは起動していない。

    ```sh
    xcrun swiftc -emit-module -enable-testing -swift-version 5 -sdk /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator27.1.sdk -target arm64-apple-ios17.0-simulator -module-name knittingEditor -module-cache-path /tmp/i10-swift-module/cache -emit-module-path /tmp/i10-swift-module/knittingEditor.swiftmodule ios/App/*.swift
    xcrun swiftc -typecheck -swift-version 5 -sdk /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator27.1.sdk -target arm64-apple-ios17.0-simulator -module-cache-path /tmp/i10-swift-module/cache -I /tmp/i10-swift-module ios/Tests/KnittingEditorAppTests/LocalWebSchemeHandlerTests.swift
    ```

  - `git diff --check`: 成功。
  - E2EとiOS実行テストは今回の担当指示に従って未実行。リード／PR CI・full CIで確認する。機内モード試験は明示的な実機設定が必要。
- デプロイ影響: none。TestFlight／App Storeの実行資産変更なし。事後の画面確認は不要。iOS CIで変更したSwiftテストのコンパイルと実行を確認する。
