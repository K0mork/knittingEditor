# 2026-10-14 — iPad共有シートの基準位置をサイズ変更に追従させる

- 影響: PNG・PDF・個別の`.knit`などの共有popoverがUIKitから再配置される際、同じsource viewの現在のbounds中央から1×1のアンカーを計算する（#158）。共有結果の確定と一時ファイルの後処理は`completionWithItemsHandler`だけが行う。activityのdismiss delegateは何も変更せず、後から届く成功・エラー結果を保持する。ユーザーによるdismissalのキャンセル通知とnative UI状態の解除もcompletion handlerから処理する。Document Pickerの終了処理は維持する。`.alert`には使われないpopover設定を削除する。
- 主なファイル: `ios/App/WebViewContainer.swift`、`ios/Tests/KnittingEditorAppTests/NativeExportResultTests.swift`、`ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 1366×1024から320×1024への縮小およびbounds原点変更時の再配置、source viewの保持、activityのdismissalが結果を通知せずpending export・一時ファイル・pickerPurpose・native UI状態を保持すること、その後のcompletionが成功・エラーを一度だけ報告してnative UI状態と一時ファイルを解除すること、Document Pickerのdismissalを検証する単体テスト4件を追加。UIテスト`testShareSheetStaysUsableAfterRotatingWhileOpen`を追加し、縦向きでPNG共有を開いてコピー項目が押せる状態から横向きへ回転し、同じ共有シートのコピー項目が存在・操作可能・ウィンドウ内にあること、dismissal後の最初のタップで出力パネルが閉じて盤面パネルを開閉できることを検証する。終了時はdeferで縦向きへ戻す。PR smoke一覧への追加はなし。
- 検証: `node --version`は`v26.8.1`（推奨Node 24との相違あり）。`xcodebuild -version`を一度実行しXcode 27.0 / 27A266aを確認。`cd ios && xcodegen generate`成功、コミット済み`ios/knittingEditor.xcodeproj`の差分なし。`bash ios/scripts/check-app-store-docs.sh`成功。`node scripts/check-pr-smoke-ui-tests.mjs`成功（一覧は変更なし）。`git diff --check`成功。Swift設定は`SWIFT_VERSION: "5.0"`で明示的なstrict concurrency設定なし。SDKのpopover delegateはMainActorで、Coordinatorの隔離と一致する。新しいSwiftファイルはなく`ios/project.yml`の変更は不要。
- 追加修正の検証: `node --version`は`v26.8.1`。`git diff --check`成功。`finishSharing`がnative UI状態を解除し、`finishPendingExport`がpendingをnilにしてから一時ディレクトリ削除と結果通知を行うことをソースで確認。非activity・非Document Pickerのdismissal時のnative UI解除fallbackは維持。コンパイル・テスト実行の証明ではない。
- 未実施: この担当の作業制約によりXcodeビルド・Swift単体テスト・Simulator実行・画面確認は行っていない。追加UIテストはヘルパーの引数・XCUIElement APIをソース上で確認したが、コンパイル・実行は未確認。共有シート表示中のウィンドウ角ドラッグの可否も未検証のため、可変幅ドラッグのXCUITest追加は保留。リードによるビルドと単体テスト、iOS 18.2 / 26.5 / 27.0のSimulator確認、可変幅・回転中の共有先表示とdismissal後の最初の編集操作、実機確認が必要。Web・共有コードの変更がないためWebの型検査・Vitest・build・check:dist・PlaywrightとiOS Webテストは未実施。マージ前のfeature branch full iOS CIとマージ後のfull iOS CIも未実施。

<!-- LEAD: simulator results -->

- デプロイ影響: Pagesへの影響はなし。アプリ配布後にiPadの可変幅・縦横で共有先が操作でき、枠外タップで閉じた直後に編集できることを確認する。#158の完了条件のうち各OS・実機・可変幅の検証は未完了。
