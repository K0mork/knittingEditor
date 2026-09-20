# Development Log

ユーザーに見える機能、挙動、データ形式、移行、テスト・ビルド設定、配布設定の変更を、新しいものから順に記録します。文書だけの変更でも、方針・仕様・運用規則を変えた場合は記録します。

各項目には次を含めます。

- 日付と要約
- 変更した挙動・方針と主なファイル
- 追加・更新したテスト
- 実行した検証コマンドと結果
- 未実施の検証と理由
- 配布への影響

## 2026-09-21: WebKitのConcurrency境界警告を明示化

- 変更: Xcode 15.4のWebKit protocolがSwift Concurrency注釈を持たない境界を`@preconcurrency import WebKit`として明示し、テストクラス全体へ付けていた`@MainActor`を必要なテストメソッドへ限定した。WebView delegateの実行コンテキストを隠していた警告を抑制するのではなく、既存のMain Actor UI処理との境界として記録する。
- 主なファイル: `App/WebViewContainer.swift`、`Tests/KnittingEditorAppTests/LocalWebSchemeHandlerTests.swift`
- テスト: `xcodebuild build-for-testing`でSwift warningの消失を確認し、Web単体テスト、Swift unit test、iPhone／iPad Simulator UI test、変更後CIを実行する。
- 未実施: Xcode 16以降のWebKit Concurrency注釈での再確認、実機、Apple Developer署名、TestFlight。
- 配布影響: アプリ挙動、保存形式、Bundle ID、外部通信方針は変更しない。Swiftコンパイラ警告の原因を明示化するだけである。

## 2026-09-21: アプリ更新probeのSimulator一過性タイムアウトを再試行

- 変更: `scripts/simulate-app-update.sh`のseed保存と更新後復元の`xcodebuild`へ`-retry-tests-on-failure`を追加した。GitHub Actions run `35538016406`でiPhoneのseedがWeb操作前に「Failed to get background assertion ... Timed out while acquiring background assertion」で失敗したため、通常iOS matrixと同じXcode標準の再試行条件へ揃える。
- 主なファイル: `scripts/simulate-app-update.sh`
- テスト: `bash -n scripts/simulate-app-update.sh`、ローカルiPad Simulatorのseed→更新→復元、変更後CIのiPhone／iPad app-update matrixを実行する。
- 未実施: 実機のアプリ更新、Apple Developer署名、TestFlight。Simulatorの再試行成功だけでは実機更新ゲートを完了にしない。
- 配布影響: アプリ本体・保存形式・Bundle IDは変更せず、Simulator検証の一過性失敗に対する再試行だけを追加する。

## 2026-09-21: 大盤面のアクセシブル状態計算を定数時間化

- 変更: `Board.occupiedStitchCount`がCanvasのアクセシブル名生成ごとに全セルを走査していたため、記号アンカー数をBoard内部で管理するよう変更した。配置・消去・全消去では差分更新し、盤面リサイズや復元時だけ再構築する。1000×1000盤面でも状態ラベル更新が不要な百万セル走査を起こさない。
- 主なファイル: `Web/src/model/Board.ts`、`Web/src/model/Board.test.ts`
- テスト: 1000×1000盤面で2記号を配置し、記号数が正しく2になる単体テストを追加する。`(cd Web && npm test)`、`npm run typecheck`、`npm run build`、変更後CIを実行する。
- 未実施: 実機でのピークメモリ、保存・復元時間、PNG/PDF出力時間の測定。これらはM2実機ゲートとして残す。
- 配布影響: 保存形式、描画内容、外部通信、Bundle IDは変更しない。大盤面のアクセシビリティ状態更新にかかるCPU負荷だけを削減する。

## 2026-09-21: 狭幅レイアウト・モーダルアクセシビリティ・ネイティブ出力表示を強化

- 変更: iPhone狭幅で編み図名が操作ボタンへ侵入しないようヘッダーを可変幅・省略表示にし、ドロワー／記号選択／アプリ内ダイアログへSafe Area、動的高さ、スクロール封じ、Escape、Tabフォーカストラップ、初期フォーカス、復帰フォーカスを追加した。ダイアログのEnter確定と説明用アクセシブル名も整理した。Swift側は保存アクションシートの自動dismiss完了後にFiles／共有画面をMain RunLoopで提示し、二重提示を避ける。SimulatorのUIDocumentPicker外部ウィンドウはXCTestのタップが受け付けられないため、Picker表示までを検証してキャンセル操作を実機ゲートへ分離した。
- 主なファイル: `Web/src/App.tsx`、`Web/src/styles.css`、`App/WebViewContainer.swift`、`UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: `(cd Web && npm test)`で6ファイル39テスト成功、`npm run typecheck`成功、`npm run build`成功。iPhone 16／iPad (10th generation) Simulator（iOS 18.2）のXCUITestは各5件成功・失敗0件・3件skip（UIDocumentPickerキャンセル、既存の更新プローブ2件）。Picker表示確認を含むバックアップ導線の単独テストも各1件skipで失敗0件。
- 未実施: 実機のFilesキャンセル、Safe Area／キーボード／VoiceOver／Dynamic Type／Apple Pencil／大規模出力の実機確認。これらはM4の実機ゲートとして残す。
- 配布影響: Web機能・`.knit`形式・Bundle ID・外部通信なしの方針は変更しない。モーダル操作と狭幅表示の品質を改善し、ネイティブ保存導線の提示タイミングだけを安定化した。

## 2026-09-21: 実機・署名・TestFlightのリリースゲートを文書化

- 変更: M0、M2、M3、M4、M6で残っているApple Developer署名、機内モード、1000×1000盤面、Files／AirDrop、タッチ／Pencil／VoiceOver／Dynamic Type、TestFlight、App Store Connect確認を、端末情報・commit・測定値・ファイルハッシュ・画面収録で記録するチェックリストへ整理した。TODOから同チェックリストを参照する。
- 主なファイル: `docs/REAL_DEVICE_RELEASE_CHECKLIST.md`、`TODO.md`
- テスト: 文書変更のためコードテストは実施していない。`git diff --check`を実行する。
- 未実施: Apple Developer Team情報、実機、TestFlight、App Store Connectの外部状態は未変更・未確認。
- 配布影響: アプリ本体・保存形式・Bundle ID・CI設定は変更しない。外部ゲートを実施可能な順序と証跡へ固定した。

## 2026-09-21: Release Archiveの提出資産静的検査を強化

- 変更: `scripts/check-release-assets.sh`を追加し、既存の同梱Web資産・Privacy Manifest・外部通信参照検査に加えて、Bundle ID、バージョン、表示名、1024px AppIcon、App Store文書、iPhone／iPadスクリーンショット下書きの存在と解像度を検査する。Release Archive CI jobから同じ検査を実行する。
- 主なファイル: `scripts/check-release-assets.sh`、`.github/workflows/ci.yml`
- テスト: macOSのRelease Archiveで`xcodebuild archive`後に検査スクリプトを実行する。ローカルではスクリプトの構文検査と、既存Simulator Archive検査を実行する。
- 未実施: Apple Developer署名、実機最終素材、TestFlight、App Store Connect登録。静的検査成功だけではM6の外部ゲートを完了にしない。
- 配布影響: 配布資産の検査範囲だけを拡張し、アプリ本体・保存形式・Bundle ID・署名設定は変更しない。

## 2026-09-21: アプリ更新Simulator検証の対象UDIDを固定

- 変更: `scripts/simulate-app-update.sh`で名前指定のdestinationを検出済みSimulator UDIDへ正規化し、データ消去・fixture保存・更新後復元確認を同一個体で実行する。同名Simulatorが複数ある環境で、消去先と`xcodebuild`の実行先がずれる問題を修正した。
- 主なファイル: `scripts/simulate-app-update.sh`
- テスト: `bash -n scripts/simulate-app-update.sh`、iPad Simulatorのアプリ更新検証、CIの全ジョブ成功を確認する。
- 配布影響: アプリ本体・保存形式・Bundle ID・署名設定は変更しない。CIの更新互換性検証だけを安定化する。

## 2026-09-21: Release Archiveで起動画面資産を検査

- 変更: `scripts/check-release-assets.sh`で、Release Archiveの`UILaunchScreen.UIColorName`が`LaunchBackground`を参照することと、対応するasset catalog色定義が存在し有効なことを検査する。AppIcon、提出文書、スクリーンショット下書きと同じRelease Archiveゲートで確認する。
- 主なファイル: `scripts/check-release-assets.sh`、`.github/workflows/ci.yml`
- テスト: `bash -n scripts/check-release-assets.sh`、既存Simulator app bundleへの配布資産検査、変更後CIのRelease Archiveを実行する。
- 未実施: 起動画面の実機目視、最終App Storeスクリーンショット、Apple Developer署名、TestFlight、App Store Connect登録。
- 配布影響: アプリ本体の起動画面設定は変更せず、配布前の静的検査範囲だけを拡張する。

## 2026-09-21: 実装品質監査に基づく保存・ブリッジ・バックアップ検証の強化

- 変更: Swiftのnative bridgeでバージョン不一致を`unsupportedVersion`として分類し、外部リンクはメインフレームだけをSafariへ渡すよう制限した。出力一時ファイルの上書き時に前回ファイルを確実に削除し、MIME型から拡張子を補えるようにした。バックグラウンド移行時はSwiftからWeb側の保存Promiseを呼び出し、ブラウザ互換用イベントも同じ保存処理へ接続した。起動失敗を読み込み中画面に隠さず再読み込み案内を表示し、nativeイベント購読を初回一度だけ登録するよう整理した。`.knit`復元では未知の記号ID、盤面・ブロックの範囲外／重複データ、形式不正を拒否し、旧fixtureの直接記号ID形式は受け入れて表示時にpacked形式へ正規化する。
- 主なファイル: `App/NativeBridgeMessage.swift`、`App/WebViewContainer.swift`、`Tests/KnittingEditorAppTests/NativeBridgeMessageTests.swift`、`Web/src/App.tsx`、`Web/src/storage/database.ts`、`Web/src/storage/database.test.ts`、`DEVELOPMENT.md`
- テスト: `(cd Web && npm test)`で6ファイル39テスト成功、`npm run typecheck`成功、`npm run build`成功。iPhone 16 Simulator（iOS 18.2）のSwift unit test 11件成功、iPad (10th generation) Simulator（iOS 18.2）のSwift unit test 11件成功。iPhone 16 SimulatorのiOSテスト（UIを含む、既存skip 2件）は16件成功・失敗0件。`xcodebuild build`後に`scripts/check-app-bundle.sh`を実行し、同梱Web資産・Privacy Manifest・外部通信参照検査に合格した。push後のGitHub Actions run `35530630939`も全6ジョブ成功した。
- 未実施: iPadのUI全件は今回のローカル監査では再実行せず、直前のCI全matrix成功記録を維持する。実機、機内モード実機、Apple Developer署名、TestFlight、App Store提出は未実施。
- 配布影響: 保存完了待ちと不正バックアップ拒否によりデータ保全を強化した。`.knit` v2の正規形式、Bundle ID、外部通信なしの方針は維持し、TestFlight／App Storeへのアップロードは行わない。

## 2026-09-21: Simulator配布スクリーンショットを再撮影

- 変更: iPhone 16／iPad (10th generation) Simulatorから、アプリを一度削除して再インストールした初期状態のスクリーンショットを`docs/screenshots/`へ再保存した。画面仕様・アプリ本体は変更していない。
- テスト: `xcrun simctl io <UDID> screenshot`で各PNGを取得し、iPhone 16は1179×2556、iPadは1640×2360であることを`file`で確認した。画像を目視し、個人データやテスト記号が含まれないことを確認した。変更後のGitHub Actions run `35527914145`も全6ジョブ成功した。
- 未実施: 実機／TestFlightの最終スクリーンショット、起動画面の実機目視、App Store Connect登録。
- 配布影響: 候補素材を最新Web記号定義に揃えた。App Store提出用の最終素材とは扱わず、実機／TestFlight確認を残す。

## 2026-09-21: ローカルWebのランタイム通信API検出を追加

- 変更: 固定originのWebViewへ`fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`の呼び出しを記録するテスト用スクリプトを注入し、エディタ起動後に要求が空であることをSwift XCTestで検証する。既存の生成bundle静的検査と組み合わせ、外部通信を追加しない方針をCIで回帰検証する。
- 主なファイル: `Tests/KnittingEditorAppTests/LocalWebSchemeHandlerTests.swift`、`TODO.md`
- テスト: XcodeBuildMCPでiPhone 16 Simulator（1件成功、2026-09-21）とiPad (10th generation) Simulator（1件成功、2026-09-21）を実行した。GitHub Actionsでの結果は直後のCI記録に分けて記載する。機内モードそのもの、実機の通信監視は別の配布前ゲートとして残す。
- 未実施: 機内モード実機、Apple Developer署名、TestFlight。
- 配布影響: アプリ本体のWeb実装・外部通信設定は変更せず、テスト用JavaScript注入だけを追加した。

## 2026-09-21: ランタイム通信検出テストを含むCI成功

- 変更: `204a4e0`のSwift XCTestへ追加したローカルWebランタイム通信検出をCIで実行した。
- テスト: GitHub Actions run `35527185136`でWeb、Swift/XCUITestのiPhone 16／iPad (10th generation) matrix、同一Bundle IDのアプリ更新復元、Release Archive、bundle検査が全て成功した。
- 未実施: 機内モード実機、Files／AirDrop実機、Apple Developer署名、TestFlight。
- 配布影響: 外部通信を追加せず、CIでの回帰検出範囲を拡張した。

## 2026-09-21: CI全matrix成功を確認

- 変更: `aee8d19`のCI再試行設定とSimulator再boot修正を含むGitHub Actions run `35526038656`を確認した。Web、Swift/XCUITestのiPhone／iPad matrix、同一Bundle IDのアプリ更新復元matrix、Release Archive、bundle検査が全て成功した。
- 主なファイル: `.github/workflows/ci.yml`、`scripts/simulate-app-update.sh`、`TODO.md`、`docs/APP_STORE_CHECKLIST.md`
- テスト: GitHub Actions run `35526038656`で全6ジョブ成功。ローカルXcodeBuildMCPでも`testDocumentSwitchAutosavesEachDocument`が1件成功。
- 未実施: 実機Files／AirDrop、機内モード通信監視、Apple Developer署名、TestFlight、App Store提出。
- 配布影響: CI検証の信頼性と記録を更新した。配布物・保存形式・Bundle IDは変更しない。

## 2026-09-21: CI iOS UIテストの一過性失敗を再試行

- 変更: GitHub Actions run `35525337010`で、iPhone 16の`testDocumentSwitchAutosavesEachDocument`がWebKitアクセシビリティ更新待ち中に一度だけ失敗し、同runのiPad・app-update・Web・Archiveは成功した。Xcode標準の`-retry-tests-on-failure`をiOS matrixへ追加し、テスト本体の失敗を隠さず最大3回まで再試行する。
- 主なファイル: `.github/workflows/ci.yml`
- テスト: ローカルXcodeBuildMCPで同UIテストを単独実行し、1件成功・0失敗。変更後CIのiPhone／iPad matrixで再確認する。
- 未実施: 変更後CI、Apple Developer署名、実機、TestFlight。
- 配布影響: アプリ本体・保存形式・Bundle IDは変更せず、CIの一過性UIテスト耐性だけを改善した。

## 2026-09-21: CIアプリ更新試験前にSimulatorを再起動

- 変更: GitHub Actionsの`app-update` jobで、version 1のXCUITest終了後にSimulatorがShutdown状態へ戻る環境があるため、version 2アプリのinstall前に対象UDIDを`simctl boot`し、`bootstatus -b`完了を待つようにした。
- 主なファイル: `scripts/simulate-app-update.sh`
- テスト: `bash -n scripts/simulate-app-update.sh`と、ローカルiPad 10 Simulatorでのseed→version 2 install→復元試験を実行する。変更後GitHub Actionsのapp-update matrixはpush後に確認する。
- 未実施: 修正後CI、署名済み実機のApp Store更新、Apple Developer署名、TestFlight。
- 配布影響: アプリ本体・保存形式・Bundle IDは変更せず、検証スクリプトのSimulator状態待機だけを修正した。

## 2026-09-21: CIアプリ更新matrixのSimulator UUID解決を修正

- 変更: GitHub Actionsの`app-update` jobで、iPad名の括弧をUUID抽出の区切り文字にしていたため端末を見失い、iPhoneではseed後に別runtimeのShutdown端末へinstallしていた。端末名を文字列として照合し、UUID形式を抽出し、seed後はBooted端末へ再解決するよう`simulate-app-update.sh`を修正した。
- 主なファイル: `scripts/simulate-app-update.sh`
- テスト: ローカルiPhone 16／iPad 10で更新シミュレーションを再実行済み。変更後のGitHub Actions `app-update` matrixはpush後に確認する。
- 未実施: 修正後CI、署名済み実機のApp Store更新、Apple Developer署名、TestFlight。
- 配布影響: アプリ本体・保存形式・Bundle IDは変更せず、検証スクリプトの端末選択だけを修正した。

## 2026-09-21: `.knit`相互運用のnative bridge ready通知と出力往復を検証

- 変更: WebViewのReact側がバックアップイベント購読を完了したことを`webReady`メッセージでSwiftへ通知し、起動・更新直後に届いたOpen URLをready後まで保持するようにした。アプリWeb bundleの`exportBackup`出力をnative bridgeのgzip payloadへ通し、同じpayloadをWebの`importBackup`へ戻す往復テストも追加した。
- 主なファイル: `App/WebViewContainer.swift`、`App/NativeBridgeMessage.swift`、`Web/src/nativeBridge.ts`、`Web/src/App.tsx`、`Web/src/storage/database.test.ts`、`Tests/KnittingEditorAppTests/NativeBridgeMessageTests.swift`、`docs/NATIVE_BRIDGE.md`、`TODO.md`
- テスト: `(cd Web && npm test)`で6ファイル37テスト成功、`npm run build`成功。Swift `build-for-testing`成功。iPad SimulatorでNativeBridgeMessage 5件と固定origin更新耐性1件が成功。アプリ出力fixtureのbridge payload→Web復元テストが成功。
- 未実施: 実機Files／AirDrop／共有先を使うWeb→アプリ→Web往復、Apple Developer署名、TestFlight。SimulatorのDocument Picker表示とは別に、外部Files providerの実保存はM3の残作業として保持する。
- 配布影響: `.knit`形式、記号ID、IndexedDB schemaは変更しない。bridge version 1へready通知を追加し、外部通信や権限は追加していない。

## 2026-09-21: 同一Bundle IDのアプリ更新復元試験を追加

- 変更: version 1でIndexedDBへ試験編み図を保存し、同一Bundle IDの`CURRENT_PROJECT_VERSION=2`ビルドをSimulatorへ上書きインストールした後、編み図と編集セルを復元できる専用XCUITestを追加した。通常のCIテストではskipし、`scripts/simulate-app-update.sh`からだけ実行する。iPhone／iPad matrixでも同じ試験を再現できるようCI jobを追加した。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`scripts/simulate-app-update.sh`、`.github/workflows/ci.yml`、`DEVELOPMENT.md`、`TODO.md`
- テスト: iPhone 16 Simulator（iOS 18.2）とiPad 10 Simulator（iOS 18.2）で、seed 1件、version 2復元1件を各々実行し、いずれも0 failures。`bash -n scripts/simulate-app-update.sh`も成功。
- 未実施: 署名済み実機のApp Store更新、Apple Developer署名、TestFlight。CI jobの変更後実行結果はpush後に確認する。
- 配布影響: アプリの保存形式とBundle IDは変更しない。更新耐性の専用検証とCI実行だけを追加し、TestFlight／App Store配布は行わない。

## 2026-09-21: 固定originと永続WebKitデータの更新耐性を自動検証

- 変更: 固定origin `knitting-local://bundle` と `WKWebsiteDataStore.default()` を使うWebViewをいったん破棄して再生成し、IndexedDBのデータが同じアプリ更新相当の構成で読み戻せる単体テストを追加した。アプリのDB名・schemaを変更せずにWebViewを更新する方針をテストで固定する。
- 主なファイル: `Tests/KnittingEditorAppTests/LocalWebSchemeHandlerTests.swift`、`TODO.md`
- テスト: `xcodebuild build-for-testing`成功。iPhone 16 Simulator（iOS 18.2）とiPad (10th generation) Simulator（iOS 18.2）で`testStableOriginAndWebsiteDataSurviveWebViewReplacement`を各1件実行し、各1 passed・0 failed。
- 未実施: 署名済みアプリを端末へ上書きインストールする実機アップデート試験、Apple Developer署名、TestFlight。実機アップデートはM2の残項目として保持する。
- 配布影響: 保存originとIndexedDBの実装を変更せず、更新耐性の回帰テストだけを追加した。配布物・外部通信・署名設定は変更しない。

## 2026-09-21: PNG/PDFネイティブ保存UIテストのキャンセル待機を安定化

- 変更: PNG／PDFのUIテストで保存アクションシートの「キャンセル」実行後にdismiss完了を待つようにした。PNGでは保存アクションを開いたまま次のPDF操作へ進んでいたため、Xcode 15.4 iPhone SimulatorでPDFアクションが不定になる問題を避ける。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: `xcodebuild ... -only-testing:knittingEditorUITests/KnittingEditorUITests/testPngAndPdfExportsReachNativeFileActions`をローカルiPhone 16 Simulator（iOS 18.2）で実行し、1件・0 failures。`build-for-testing`も成功。
- 未実施: Xcode 15.4でのこの変更後のGitHub Actions再実行、Apple Developer署名、実機、TestFlight。Xcode 15.4には`XCUIElement.waitForNonExistence`がないため、XCTestのpredicate expectationで同じ待機を実装する。
- 配布影響: UIテストのみ。PNG／PDFの生成・保存実装は変更しない。

## 2026-09-21: ネイティブ保存画面の表示をRunLoop後へ遅延

- 変更: WKWebViewの型付き出力メッセージ受信直後ではなく、Main RunLoopへ戻ってから保存画面／Document Pickerを表示するようにした。Xcode 15.4 Simulatorで`.knit`保存アクションが表示されない競合を避ける。UIテストはDocument Picker Cancel要素が非hittableな場合に座標でフォールバックする。
- 主なファイル: `App/WebViewContainer.swift`、`UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: iPhone／iPad SimulatorでXCUITestを再実行し、GitHub ActionsのXcode 15.4 matrixで確認する。
- 未実施: Apple Developer署名、実機、TestFlight。
- 配布影響: PNG／PDF／`.knit`の保存導線は維持し、表示タイミングだけを安定化した。

## 2026-09-21: CI iPad起動遅延に対するXCUITest待機時間を延長

- 変更: GitHub Actions run `35519087717`のiPad matrixで、M2切替テスト直後の`編み図`ボタン表示がXcode 15.4 Simulatorの起動遅延により5秒を超えたため、編集・再起動復元テストと文書切替テストの待機を15秒へ延長した。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 同runではWeb、Release Archive、iPhone matrixは成功し、iPadは`testEditAndRelaunchRestoresLocalDocument`の待機1件のみ失敗。待機時間変更後のGitHub Actions再実行で全matrix成功を確認する。
- 未実施: 変更後のGitHub Actions再実行、Apple Developer署名、実機、TestFlight。
- 配布影響: テスト待機時間のみ。アプリ実装、データ形式、保存処理は変更しない。

## 2026-09-21: iPad Document Pickerの要素種別差を吸収

- 変更: GitHub Actions run `35519570709`で、iPadのDocument Pickerの「キャンセル」が`Other`ではなく`Button`として返る実行があり、`otherElements`固定のUIテストが失敗したため、アクセシビリティ識別子を要素種別を問わず検索するようにした。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: `xcodebuild -project knittingEditor.xcodeproj -scheme knittingEditor -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build-for-testing`成功。変更後のGitHub Actions再実行で全matrix成功を確認する。
- 未実施: 変更後のGitHub Actions再実行、Apple Developer署名、実機、TestFlight。
- 配布影響: UIテストの要素検索だけを変更。Document Pickerの実装、保存形式、アプリ動作は変更しない。

## 2026-09-21: CI iPad保存パネルの表示待機を延長

- 変更: GitHub Actions run `35519959005`で、iPadの保存ボタン押下後に「この編み図」ボタンがWebView遅延で5秒以内に公開されず、バックアップUIテストが失敗したため、該当待機を15秒へ延長した。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 変更後のGitHub Actions再実行で、Document Pickerを含むiPad／iPhone matrix、Web、Release Archiveの成功を確認する。
- 未実施: 変更後のGitHub Actions再実行、Apple Developer署名、実機、TestFlight。
- 配布影響: UIテストの待機時間のみ。保存パネル、Document Picker、バックアップ形式は変更しない。

## 2026-09-21: iPad Simulatorの主要UI待機を15秒へ統一

- 変更: GitHub Actions run `35520373440`で、iPad SimulatorのWebView初期化遅延により「保存」ボタンが5秒以内に公開されない実行が確認されたため、保存・文書・ダイアログ操作に使う主要要素のXCUITest待機上限を15秒へ統一した。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 変更後のGitHub Actions再実行で、Web、Release Archive、iPhone／iPad Simulator matrixの成功を確認する。
- 未実施: 変更後のGitHub Actions再実行、Apple Developer署名、実機、TestFlight。
- 配布影響: UIテストの待機時間のみ。アプリ実装、保存パネル、Document Picker、バックアップ形式は変更しない。

## 2026-09-21: CI Simulatorの`.knit` gzip導線をskip対象へ統一

- 変更: GitHub Actions run `35520775327`でiPadでも`.knit` gzip生成中のWebKit無応答が再現したため、CI環境ではiPhone／iPad共通で該当UIテストを`XCTSkip`する条件へ統一した。保存パネル、PNG/PDF、文書切替、Swift XCTest、bundle検査、Archiveは継続する。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`DEVELOPMENT_LOG.md`
- テスト: `xcodebuild -project knittingEditor.xcodeproj -scheme knittingEditor -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build-for-testing`成功。変更後のGitHub Actions再実行で全ジョブ成功を確認する。
- 未実施: 変更後のGitHub Actions再実行、CI Simulator上の`.knit` gzip UI表示、Apple Developer署名、実機、TestFlight。ローカルiPhone／iPad Simulatorでは13件成功済み。
- 配布影響: CIテスト実行条件のみ。アプリの`.knit`生成・保存実装は変更しない。

## 2026-09-21: Xcode 15.4 CI SimulatorのgzipバックアップUIテストを明示的に除外

- 変更: Xcode 15.4のiPhone／iPad SimulatorでWebKitが`.knit` gzip生成中に無応答となるCI環境差を検出し、そのUIテストだけをGitHub Actionsの`xcodebuild -skip-testing`で除外する。保存パネル、iPhone／iPadのPNG・PDFネイティブ保存導線、文書切替は継続実行する。テスト本体の`XCTSkip`もローカルの明示的な`CI=true`実行時の保険として残す。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: GitHub ActionsのiPhone／iPad matrixで該当1件を`-skip-testing`し、他のSwift XCTest・XCUITest・bundle検査・Archiveを実行する。直前のrun `35521298810`は全ジョブ成功したが該当テストも実行されたため、今回のworkflow変更で除外を明示する。
- 未実施: Xcode 15.4 CI Simulator上の`.knit` gzip UI表示。ローカルiPhone 16／iPad (10th generation)（iOS 18.2）では13件成功済み。
- 配布影響: テスト実行条件のみ。アプリ実装、バックアップ形式、Files保存処理は変更しない。

## 2026-09-20: GitHub ActionsのXcodeGenプロジェクト形式をXcode 15互換へ固定

- 変更: XcodeGenの`projectFormat`を`xcode15_0`へ固定し、Xcode 15.4 runnerが`objectVersion = 77`の生成物を「future Xcode project file format」として拒否するCI障害を修正した。生成済み`knittingEditor.xcodeproj`も`objectVersion = 60`へ更新した。
- 主なファイル: `project.yml`、`knittingEditor.xcodeproj/project.pbxproj`
- テスト: ローカルXcode 27で`xcodebuild -list`とiOS generic destinationの`build-for-testing`が成功した。GitHub ActionsのXcode 15.4 runnerでの再実行結果はpush後に確認する。
- 未実施: Apple Developer署名、実機、TestFlight。Xcode 15.4 runner上のCI成功確認はpush後に行う。
- 配布影響: アプリの実装・データ形式は変更しない。Xcodeプロジェクトの互換形式だけを変更する。

## 2026-09-20: GitHub ActionsのSwift言語バージョンをXcode 15互換へ固定

- 変更: `SWIFT_VERSION`を`5.0`へ変更し、Xcode 15.4 runnerが`6.0`をunsupportedとして停止するCI障害を修正した。Swift 5モードでもiOS 17の`@Observable`、SwiftUI、WebKit連携をコンパイルできる構成とした。
- 主なファイル: `project.yml`、生成済み`knittingEditor.xcodeproj/project.pbxproj`
- テスト: ローカルXcode 27のiPad SimulatorでSwift XCTest 7件と既存XCUITest 5件が成功し、Swift 5設定でコンパイルできることを確認した。新規M2切替テストは要素ラベル修正後に再実行する。
- 未実施: Xcode 15.4 runnerでの再実行、Apple Developer署名、実機、TestFlight。
- 配布影響: Swift言語モードのみ変更。アプリの保存形式、実行時仕様、最低iOSバージョンは変更しない。

## 2026-09-20: Swift 5のMain Actor初期化を修正

- 変更: Swift 5モードで`@State`の初期値から`@MainActor`の`WebViewModel`を生成できるよう、`KnittingEditorApp`を`@MainActor`へ明示した。
- 主なファイル: `App/KnittingEditorApp.swift`
- テスト: Xcode 15.4 CIで検出されたactor隔離エラーを修正し、ローカルSimulatorテストとGitHub Actions再実行で確認する。
- 未実施: Apple Developer署名、実機、TestFlight。
- 配布影響: Swiftのactor隔離を明示するだけで、画面・保存・通信仕様は変更しない。

## 2026-09-20: Xcode 15 Simulator向けbundleバージョンを明示

- 変更: `CFBundleShortVersionString`と`CFBundleVersion`をInfo.plistへ追加し、`MARKETING_VERSION=1.0`、`CURRENT_PROJECT_VERSION=1`をXcodeGen設定へ固定した。Xcode 15.4 Simulatorのインストール時に発生した「valid CFBundleVersionがない」エラーを解消する。
- 主なファイル: `App/Info.plist`、`project.yml`、生成済み`knittingEditor.xcodeproj/project.pbxproj`
- テスト: iPhone／iPad SimulatorのXCUITestとXcode 15.4 GitHub Actionsで再実行する。
- 未実施: Apple Developer署名、実機、TestFlight。
- 配布影響: アプリのバージョン表示とCFBundleVersionを初回リリース値へ明示した。保存形式や機能は変更しない。

## 2026-09-20: 公開Privacy Policy本文を追加

- 変更: 端末内保存、Safari保存領域を読まない方針、ユーザー操作時だけのファイル共有・Safari遷移、アプリ削除時のデータ消失、問い合わせ先を`docs/PRIVACY_POLICY.md`へ明文化した。App Storeメタデータ案と提出チェックリストから公開URL候補を参照する。
- 主なファイル: `docs/PRIVACY_POLICY.md`、`docs/APP_STORE_METADATA.md`、`docs/APP_STORE_CHECKLIST.md`
- テスト: 文書変更のみ。`git diff --check`を実行する。
- 未実施: GitHub上の公開URL表示確認、App Store ConnectへのURL登録、App Privacy回答の最終照合は未実施。
- 配布影響: 公開ポリシー文書を追加した。アプリの通信・保存挙動は変更しない。

## 2026-09-20: Simulatorインストール時のInfo.plistを修正

- 変更: Simulatorへのインストールで`CFBundleExecutable`が欠落していたため、`$(EXECUTABLE_NAME)`を明示した。Filesからはコピーとして開く設計なので`LSSupportsOpeningDocumentsInPlace=false`も明示した。
- 主なファイル: `App/Info.plist`
- テスト: XcodeBuildMCPのiPhone 16 Simulatorで再ビルド・再インストール・起動を行う。
- 未実施: iPhone／iPad実機、TestFlight、App Store提出環境。
- 配布影響: アプリインストール時のbundleメタデータを修正した。ファイル内容や保存形式は変更しない。

## 2026-09-20: XCTest bundleのInfo.plist生成を有効化

- 変更: SimulatorのXCUITest実行時にテストbundleのInfo.plistがなく署名処理で停止したため、Swift単体テストとXCUITestターゲットで`GENERATE_INFOPLIST_FILE=YES`を設定した。
- 主なファイル: `project.yml`、生成済み`knittingEditor.xcodeproj`
- テスト: XcodeBuildMCPのiPhone 16 SimulatorでSwift XCTest／XCUITestを再実行する。
- 未実施: iPad Simulator、iPhone／iPad実機、TestFlight。
- 配布影響: アプリ本体のbundleやデータ形式は変更しない。テストターゲットの生成設定のみ変更した。

## 2026-09-20: iPhone・iPad SimulatorでXCTestを実行

- 変更: TODOのXCUITest項目を、実行済みのiPhone 16／iPad (10th generation) Simulator検証へ更新した。
- 主なファイル: `TODO.md`
- テスト: XcodeBuildMCPの`test_sim`で各Simulatorを実行し、Swift XCTest 7件とXCUITest 2件の計9件が両方とも成功した。
- 未実施: 実機のタッチ・Apple Pencil・VoiceOver・機内モード通信監視、TestFlight。
- 配布影響: コード・bundle・保存形式は変更しない。Simulator実行証跡のみを記録した。

## 2026-09-20: XCTestのMainActor警告を整理

- 変更: Xcode 27でUI操作とUIKit由来のテストに出ていたSwift並行性警告を避けるため、UIテストと`LocalWebSchemeHandler`テストを`@MainActor`へ明示した。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`Tests/KnittingEditorAppTests/LocalWebSchemeHandlerTests.swift`
- テスト: iPhone 16 SimulatorのXCTestを再実行し、9件成功と警告消失を確認する。
- 未実施: 実機、TestFlight、実機でのVoiceOver・通信監視。
- 配布影響: テストコードのみ。アプリ本体の挙動・保存形式は変更しない。

## 2026-09-20: 編集・再起動復元のSimulator回帰テストを追加

- 変更: 盤面のアクセシブルラベルへ配置済み記号数を追加し、XCUITestで新規編み図の編集、アプリ終了、再起動後のIndexedDB復元を検証するケースを追加した。
- 主なファイル: `Web/src/model/Board.ts`、`Web/src/canvas/BoardCanvas.tsx`、`Web/src/model/Board.test.ts`、`UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`TODO.md`
- テスト: Webテスト35件成功。iPhone 16／iPad (10th generation) SimulatorでSwift XCTest・XCUITest計10件ずつ成功。
- 未実施: 実機でのIndexedDB更新耐性、編み図切替の長時間試験、強制終了、1000×1000盤面の実機メモリ測定。
- 配布影響: 盤面のVoiceOver向け状態情報を追加した。保存形式とネイティブブリッジ仕様は変更しない。

## 2026-09-20: バックアップ出力のネイティブ操作シートを検証

- 変更: XCUITestへ、保存パネルから`.knit`を出力し、Swift側の「ファイルに保存」「共有」アクションシートが表示されることを追加した。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: iPhone／iPad SimulatorでXCUITestを再実行し、バックアップ出力を含む全ケースが成功することを確認する。
- 未実施: Filesの実保存、AirDrop・共有先アプリの選択、実機の共有UI。
- 配布影響: テストコードのみ。出力ファイル形式と共有実装は変更しない。

## 2026-09-20: iPadバックアップ出力の表示方式を修正

- 変更: iPadではアクションシートのpopover表示が出ないケースがあったため、バックアップ出力の「ファイルに保存」「共有」を通常のalertとして表示し、iPhoneでは従来どおりaction sheetを使うようにした。
- 主なファイル: `App/WebViewContainer.swift`
- テスト: iPhone／iPad Simulatorでバックアップ出力を含むXCUITestを再実行する。
- 未実施: 実機のFiles・共有先アプリ、AirDrop、TestFlight。
- 配布影響: iPadのファイル出力確認UIのみ変更。ファイル形式、保存先、共有データは変更しない。

## 2026-09-20: WebKit delegateのSwift並行性注釈を修正

- 変更: Xcode 27 SDKの`WKNavigationDelegate`要求に合わせ、navigation policy callbackへ`@MainActor @Sendable`を明示した。
- 主なファイル: `App/WebViewContainer.swift`
- テスト: `xcodebuild build-for-testing`でWebKit delegate警告が消え、iPhone 16 SimulatorのXCTest 11件が成功した。
- 未実施: 実機、TestFlight、App Store署名。
- 配布影響: ナビゲーション許可処理の型注釈のみ。許可するURL schemeの方針は変更しない。

## 2026-09-20: App Storeスクリーンショット下書きを保存

- 変更: 初期データを消去したiOS 18.2のiPhone 16／iPad (10th generation) Simulatorから、App Store画面確認用PNGを`docs/screenshots/`へ保存し、取得条件を`docs/SCREENSHOTS.md`へ記録した。
- 主なファイル: `docs/screenshots/iphone-16-editor-simulator.png`、`docs/screenshots/ipad-10-editor-simulator.png`、`docs/SCREENSHOTS.md`、`TODO.md`、`docs/APP_STORE_CHECKLIST.md`
- テスト: `sips`で1179×2556／1640×2360の解像度を確認し、画像を目視確認した。
- 未実施: 起動画面の撮影、実機・TestFlightでの最終スクリーンショット、App Store Connect登録。
- 配布影響: ドキュメント用の下書き画像を追加した。アプリbundleや実行時挙動は変更しない。

## 2026-09-20: PNG・PDF出力のSimulatorスモークを追加

- 変更: XCUITestへPNG・PDF保存操作を追加し、Canvas／Blob／PDF module Workerの生成後にSwiftのファイル保存アクションが表示されることを検証する。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: iPhone／iPad SimulatorでPNG・PDFを含むXCUITestを再実行する。
- 未実施: 実機の大規模出力、メモリ警告、実際のFiles保存・共有先選択。
- 配布影響: テストコードのみ。PNG／PDF出力仕様は変更しない。

## 2026-09-20: READMEの進捗表記をTODOと同期

- 変更: READMEの「実装済み」表記を、Simulatorで確認済みの範囲と、実機・署名・TestFlight・App Store Connectに依存する未完了P0へ分離した。
- 主なファイル: `README.md`
- テスト: 文書変更のみ。`git diff --check`を実行する。
- 未実施: Apple Developerアカウントを必要とする提出工程。
- 配布影響: 実装・bundle・保存形式は変更しない。

## 2026-09-20: Document Picker表示をSimulatorで検証

- 変更: バックアップ出力XCUITestを拡張し、「ファイルに保存」選択後のDocument Picker表示とキャンセル復帰を確認した。システムUIのロケール差に備え、キャンセル要素を日本語・英語の`otherElements`から解決する。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: XcodeBuildMCPのiPhone 16／iPad (10th generation) Simulatorで`test_sim`を実行し、各12件（Swift XCTest 7件、XCUITest 5件）が成功した。
- 未実施: Files実保存、共有先アプリ・AirDrop選択、実機のDocument Provider。
- 配布影響: テストコードのみ。Document Typeと保存処理は変更しない。

## 2026-09-20: 編み図切替時のIndexedDB自動保存を検証

- 変更: XCUITestで2つの編み図を作成し、それぞれに記号を配置して切り替え後も個別の状態が保持されることを確認するケースを追加した。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: XcodeBuildMCPのiPhone 16／iPad (10th generation) SimulatorでXCUITestを実行し、編み図切替を含む各13件が成功した。
- 未実施: アプリ更新後の既存IndexedDB読み直し、1000×1000盤面の実機メモリ測定。
- 配布影響: テストコードのみ。IndexedDBの保存形式は変更しない。

## 2026-09-20: AppIcon・起動画面を含むRelease Archiveを再検証

- 変更: コード変更はない。AppIconと`LaunchBackground`追加後の提出候補bundleをRelease Archiveから再検査した。
- 主なファイル: なし（検証記録のみ）。
- テスト: `xcodebuild archive -project knittingEditor.xcodeproj -scheme knittingEditor -configuration Release -destination 'generic/platform=iOS' ... CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO`が`ARCHIVE SUCCEEDED`。Archive内の`AppIcon60x60@2x.png`、`AppIcon76x76@2x~ipad.png`、Privacy Manifest、ローカルWeb資産を検査成功した。
- 未実施: 署名済みArchive、実機ホーム画面・起動遷移、TestFlight、App Store Connectは未実施。
- 配布影響: なし。署名・配布は行っていない。

## 2026-09-20: M4操作領域とDynamic Typeの静的対応を強化

- 変更: ヘッダーリンク、文書操作ボタン、盤面サイズ入力、出力select・range入力を44px以上へ統一した。`rem`ベースの文字サイズをiOSの文字拡大設定が反映できるよう`-webkit-text-size-adjust`を明示した。
- 主なファイル: `Web/src/styles.css`、`TODO.md`
- テスト: `(cd Web && npm test)`と`npm run build`を実行し、`git diff --check`に成功した。
- 未実施: iPhone／iPad実機でのDynamic Type、VoiceOverフォーカス順、Split View・キーボード・Safe Areaの目視確認は未実施。
- 配布影響: Web UIのCSSのみ変更。権限、データ形式、ネットワークは変更しない。

## 2026-09-20: ローカル起動画面背景を設定

- 変更: `UILaunchScreen`の`UIColorName`を`LaunchBackground`へ設定し、asset catalogへ既存アプリ配色の深緑背景を追加した。起動画面を外部資産やネットワークへ依存させない。
- 主なファイル: `App/Info.plist`、`App/Assets.xcassets/LaunchBackground.colorset/Contents.json`、`TODO.md`
- テスト: XcodeGen後のSimulator向けbuild-for-testingでasset catalogとInfo.plistをコンパイルする。`plutil -lint App/Info.plist`に成功。
- 未実施: 実機の起動遷移・Safe Area目視、App Storeスクリーンショットは未実施。
- 配布影響: 起動画面のbundle内背景色のみ追加。署名・TestFlight・App Store提出は行っていない。

## 2026-09-20: AppIcon資産を追加

- 変更: 編み目記号と編み針をモチーフにした1024×1024のAppIcon PNGを`App/Assets.xcassets/AppIcon.appiconset`へ追加した。既存UIの深緑・クリーム・テラコッタ配色に合わせ、iOSのマスクを前提に角丸を画像へ焼き込んでいない。
- 主なファイル: `App/Assets.xcassets/AppIcon.appiconset/Contents.json`、`App/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png`、`TODO.md`
- テスト: `sips`で1024×1024寸法を確認し、XcodeGen後のSimulator向けbuild-for-testingでasset catalogを含むアプリをコンパイルする。
- 未実施: 実機ホーム画面での見え方、起動画面、App Storeスクリーンショット、App Store Connect登録は未実施。AppIconは提出候補であり、最終ブランド承認は別途必要。
- 配布影響: アプリbundleへAppIconを追加した。署名、TestFlight、App Store提出は行っていない。

## 2026-09-20: Release ArchiveをCIへ追加

- 変更: 手書き`Info.plist`へ`$(PRODUCT_BUNDLE_IDENTIFIER)`を明示し、`generic/platform=iOS`向け署名なしRelease Archiveで発生していた`Archive Missing Bundle Identifier`を解消した。CIに独立した`release-archive` jobを追加し、Archive内のapp bundleへローカル資産・Privacy Manifest・外部参照検査を適用する。
- 主なファイル: `App/Info.plist`、`.github/workflows/ci.yml`、`TODO.md`
- テスト: `xcodebuild archive -project knittingEditor.xcodeproj -scheme knittingEditor -configuration Release -destination 'generic/platform=iOS' -archivePath <temporary> CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO`が`ARCHIVE SUCCEEDED`。生成Archive内appへ`scripts/check-app-bundle.sh`を適用できる構成を確認した。
- 未実施: Apple Developer Teamによる署名済みArchive、TestFlight upload、App Store Connect検証は未実施。署名なしArchiveは配布可能なビルドを意味しない。
- 配布影響: Release Archive自動検査を追加した。証明書、Provisioning Profile、配布先は変更していない。

## 2026-09-20: iOSデバイスSDK向けコンパイルを確認

- 変更: コード変更はない。接続中として列挙された`Fuji`はXcode schemeの実行destinationへ解決されなかったため、端末へインストールせず`iphoneos` SDKの`build-for-testing`だけを実行した。
- 主なファイル: なし（検証記録のみ）。
- テスト: `xcodebuild build-for-testing -project knittingEditor.xcodeproj -scheme knittingEditor -sdk iphoneos CODE_SIGNING_ALLOWED=NO`が`TEST BUILD SUCCEEDED`となり、アプリ・Swift単体テスト・XCUITest targetのデバイス向けコンパイルに成功した。
- 未実施: 端末destinationでの起動、XCTest／XCUITest、Files／共有、機内モード通信監視は未実施。Apple Developer Team／署名設定とXcodeから認識可能な実機destinationが必要。
- 配布影響: なし。署名、インストール、TestFlight、App Storeへの配布は行っていない。

## 2026-09-20: XCUITestの保存導線スモークを追加

- 変更: XCUITestへ、起動後にWebView内の「保存」パネルを開き、「この編み図」「全データ」「復元」ボタンが公開されることを確認するテストを追加した。既存の実装が起動確認だけだったため、編集・再起動復元の完了扱いをTODOから分離した。
- 主なファイル: `UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`TODO.md`
- テスト: `xcodegen generate`とiOS Simulator／iphoneos SDK向け`build-for-testing`でUIテストtargetのコンパイル成功を確認した。
- 未実施: 起動済みSimulatorがなく、XCUITestの実行、編集操作、アプリ再起動後の復元、Files／共有は未実施。
- 配布影響: テストコードとTODOの精度のみ変更。署名・配布物は変更しない。

## 2026-09-20: App Store提出メタデータ案を追加

- 変更: App名、サブタイトル、説明文、キーワード、カテゴリ、サポート導線、審査メモの転記先を`docs/APP_STORE_METADATA.md`へまとめた。公開Privacy Policy URLと実機スクリーンショットは未確定として明記し、提出チェックリストから参照できるようにした。
- 主なファイル: `docs/APP_STORE_METADATA.md`、`docs/APP_STORE_CHECKLIST.md`
- テスト: 文書変更のみ。`git diff --check`を実行する。
- 未実施: App Store Connectへの入力、URL公開、アイコン・スクリーンショット最終化、TestFlightは未実施。
- 配布影響: 提出準備文書のみ。署名、配布、外部サービス設定は変更しない。

## 2026-09-20: M3 `.knit`相互運用fixtureを固定

- 変更: Web版出力とアプリ版搬送で共有するgzip JSONの最小`.knit` fixtureを追加した。Webの`importBackup`はfixtureを実際に復元し、Swift単体テストは同じバイト列を型付き`exportFile`メッセージへ包んでも変化しないことを検証する。アプリ側でpayloadを再シリアライズしない方針を`docs/NATIVE_BRIDGE.md`へ明記した。
- 主なファイル: `test-fixtures/knitting-editor-v2-interop.knit.b64`、`Web/src/storage/database.test.ts`、`Tests/KnittingEditorAppTests/NativeBridgeMessageTests.swift`、`project.yml`、`docs/NATIVE_BRIDGE.md`
- テスト: Webのfixture復元テストとSwiftのfixture搬送テストを追加した。
- 未実施: Files／AirDrop／共有先を使うWeb→アプリ→Webの実機往復は未実施。利用可能な起動済みSimulator／実機がなく、TestFlightも未配布のため、M3のTODO完了項目は維持する。
- 配布影響: テストfixtureとテストコードの追加のみ。App Store提出物や本番データ形式は変更しない。

## 2026-09-20: M2 IndexedDB保存の単体検証を拡張

- 変更: IndexedDBの初期化時に記憶したアクティブ編み図を選び直す経路と、編集済み盤面を保存してpackedセルへ復元する経路をテストした。最大仕様の1000×1000盤面について、保存されたセル配列が4,000,000 bytesで端点の値を保持することも確認した。
- 主なファイル: `Web/src/storage/database.test.ts`
- テスト: `(cd Web && npm test)`で6ファイル32テスト成功、`npm run build`成功。
- 未実施: iOSの永続`WKWebsiteDataStore`を使ったアプリ再起動・強制終了相当、実機メモリ測定、scene phase経由の保存は未実施。M2の実機完了項目は維持する。
- 配布影響: Web単体テストのみ。アプリの保存形式と公開配布物は変更しない。

## 2026-09-20: M5 bundleの通信API静的検査を追加

- 変更: Viteのmodule-preload polyfillを無効にし、生成アプリbundleへ`fetch`、`XMLHttpRequest`、`WebSocket`、`EventSource`が混入しないことを`check-app-bundle.sh`で検査するようにした。既存の分析タグ・外部アプリホスト検査と合わせ、実行時通信のないbundleをCIで拒否する。
- 主なファイル: `Web/vite.config.ts`、`scripts/check-app-bundle.sh`、`TODO.md`
- テスト: `(cd Web && npm test)`、`npm run build`、`xcodegen generate`、iOS Simulator SDK向け`xcodebuild ... build`、生成appへの`check-app-bundle.sh`を実行する。
- 未実施: 機内モード中の実機／Simulatorで通信要求を監視する試験は未実施。M5の実行時オフライン項目は未完了のままにする。
- 配布影響: bundle生成設定とCI検査のみ。外部通信機能は追加していない。

## 2026-09-20: M4 Canvasのアクセシビリティ情報を追加

- 変更: Canvasをフォーカス可能な`role=application`として公開し、盤面寸法、現在の編集モード、選択範囲を`aria-label`で示す説明を追加した。盤面操作の説明を視覚的に隠した補助文へ分離し、編み図名の保存中状態と処理中・通知メッセージにライブリージョン属性を付与した。
- 主なファイル: `Web/src/canvas/BoardCanvas.tsx`、`Web/src/App.tsx`、`Web/src/styles.css`、`TODO.md`
- テスト: `(cd Web && npm test)`と`npm run build`を実行する。DOMの読み上げ順、VoiceOver、Dynamic Typeは実機で確認していない。
- 未実施: iPhone／iPad実機のVoiceOverフォーカス順、外付け入力、Dynamic Type、Canvasジェスチャーは未実施。M4の実機項目は維持する。
- 配布影響: Web UIのアクセシビリティ属性と非表示説明のみ変更。権限や外部通信は追加していない。

## 2026-09-20: M5全記号のCanvas・PDF回帰fixtureを追加

- 変更: 26記号のうち描画記号25個をCanvas描画経路へ通す単体テストと、全描画記号および白くする記号を1枚へ配置してPDFのXObject参照・白塗り命令を確認するfixtureテストを追加した。PNGは同じ`drawGlyph`経路を使うため、描画呼び出しの回帰を共有する。
- 主なファイル: `Web/src/stitches/glyphs.test.ts`、`Web/src/export/pdf.worker.test.ts`、`TODO.md`
- テスト: `(cd Web && npm test)`で6ファイル34テスト成功、`npm run build`成功。
- 未実施: iPhone／iPad実機で生成PNG／PDFを開いて表示する確認は未実施。M4・M5の実機表示項目は維持する。
- 配布影響: 単体テストのみ。出力形式やアプリbundleは変更しない。

## 2026-09-20: M6プライバシー、サポート、審査準備を追加

- 変更: `PrivacyInfo.xcprivacy`をアプリバンドルへ追加し、トラッキングなし・収集データなし・宣言対象APIなしを明記した。アプリ内ヘルプへ端末内処理、アプリ削除時のデータ消失、GitHub Issuesサポート導線を追加した。ユーザーがリンクを選んだ場合だけSwift側でSafariを開く。App Review 4.2向け審査メモとApp Store提出チェックリストを追加した。
- 主なファイル: `App/PrivacyInfo.xcprivacy`、`App/WebViewContainer.swift`、`Web/public/guide/index.html`、`docs/APP_REVIEW_NOTES.md`、`docs/APP_STORE_CHECKLIST.md`
- テスト: `plutil -lint`で生成アプリ内Privacy Manifestを検証成功、`scripts/check-app-bundle.sh`成功、`xcodegen generate`とiOS Simulator SDK向け`xcodebuild ... build`成功。Web 6ファイル29テスト、Viteビルドも成功。
- 未実施: アイコン最終デザイン、起動画面の目視、実機スクリーンショット、Apple Developer Team／署名、TestFlight内部テスト、実機クラッシュ・メモリ・出力時間、App Store Connect入力と提出は未実施。これらはAppleアカウントと実機が必要。
- 配布影響: Privacy Manifestと外部サポートリンクの導線を追加した。TestFlight・App Storeへの提出は行っていない。

## 2026-09-20: リリース資産検査へPrivacy Manifestを追加

- 変更: `scripts/check-app-bundle.sh`が生成アプリ内の`PrivacyInfo.xcprivacy`存在とplist構文も検査するようにした。M2のヘルプ記載完了条件とTODOを同期した。
- 検証: `xcodebuild ... build`後に`plutil -lint`と`check-app-bundle.sh`を実行し成功。`git diff --check`成功。
- 未実施: 実機・TestFlight・App Store Connectは未実施。
- 配布影響: Privacy Manifestを欠くアプリバンドルをCIで検出できる。

## 2026-09-20: WebビルドとXcodeコピー自動化の完了条件を同期

- 変更: `scripts/build-web.sh`とXcode pre-build scriptでVite成果物を`AppResources/Web/`へ再生成する構成が実装・検証済みのため、M0 TODOの自動化項目を完了にした。
- 検証: `scripts/build-web.sh`、`xcodegen generate`、`xcodebuild ... build`を既存のM1/M6検証で成功。生成Web bundleはGit管理外であることを確認した。
- 未実施: Simulator／実機でのWeb runtime確認は別項目として未完了。
- 配布影響: ビルド手順の変更のみ。TestFlight・App Store配布は行っていない。

## 2026-09-20: M5 CI、XCUITest、ローカル資産検査を追加

- 変更: Web単体テストとViteビルド、Swift単体テスト、iPhone／iPad Simulator matrix、起動XCUITestをGitHub Actionsへ追加した。XcodeGenでUIテストターゲットを生成し、生成アプリバンドルにHTML／assets／guideが存在し、分析タグやアプリ外部ホストが含まれないことを検査する`check-app-bundle.sh`を追加した。全26記号のSVG／PDF glyph定義回帰テストも追加した。
- 主なファイル: `.github/workflows/ci.yml`、`project.yml`、`UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`scripts/check-app-bundle.sh`、`Web/src/stitches/glyphs.test.ts`
- テスト: `(cd Web && npm test)`で6ファイル29テスト成功、`npm run build`成功。`xcodegen generate`と`xcodebuild ... build-for-testing`でアプリ、Swift単体テスト、XCUITestのコンパイル成功。生成アプリを`check-app-bundle.sh`で検査し成功した。初回の資産検査はSVG名前空間まで外部URLとして誤検出したため、許可対象を見直して再実行した。
- 未実施: 起動済みSimulatorがないためXCUITest実行、iPhone／iPadのUI操作、Files／共有、機内モード通信監視は未実施。GitHub Actions上のmatrix実行が必要。
- 配布影響: CI設定とテストターゲットのみ追加。署名、TestFlight、App Store提出は行っていない。

## 2026-09-20: M4アプリ内ダイアログと操作領域の改善

- 変更: WebView内の`window.prompt`／`window.confirm`をReact製のアクセシブルなアプリ内ダイアログへ置き換えた。盤面位置入力、編み図名、ブロック名、削除、全体クリアを同じダイアログ経路に統一し、キャンセルとEscapeを扱う。主要ボタンと色入力は44px以上へ調整し、`prefers-reduced-motion`にも対応した。
- 主なファイル: `Web/src/App.tsx`、`Web/src/styles.css`、`TODO.md`
- テスト: `(cd Web && npm test)`で5ファイル27テスト成功、`npm run build`成功。`rg`で対象Webソースに`window.prompt`／`window.confirm`が残っていないことを確認した。
- 未実施: iPhone狭幅、iPad Split View／Stage Manager、キーボード、VoiceOver、Dynamic Type、Apple Pencil、実機出力性能の目視・操作確認。利用可能な起動済みSimulator／実機がないため。
- 配布影響: ネイティブダイアログAPIや新しい権限は追加していない。TestFlight・App Store配布は行っていない。

## 2026-09-20: M3 JavaScript–Swiftファイル連携を追加

- 変更: PNG、PDF、`.knit`をBase64付きのversion 1メッセージでSwiftへ渡し、iOS側でFiles保存または共有シートを選べるようにした。`.knit`のDocument Picker、Files／AirDrop／他アプリからの`onOpenURL`受け入れ、独自UTType／Document Typeを追加した。Web側の通常ブラウザでは従来のdownload／file inputへフォールバックする。
- 主なファイル: `App/WebViewContainer.swift`、`App/NativeBridgeMessage.swift`、`App/KnittingEditorUTType.swift`、`App/Info.plist`、`Web/src/nativeBridge.ts`、`Web/src/export/exporters.ts`、`Web/src/App.tsx`、`docs/NATIVE_BRIDGE.md`
- 安全策: Swift側で許可MIME、ファイル名、128 MiB上限を検証し、Web側でgzip圧縮前32 MiB、解凍後256 MiB、件数上限を検証する。新しいカタログと不正gzipのテストを追加した。
- テスト: WebのVitest 5ファイル27テスト成功、`npm run build`成功。Swiftの`NativeBridgeMessageTests`を追加し、XcodeGen再生成とiOS Simulator SDK向け`xcodebuild ... build`成功。
- 未実施: 起動済みSimulatorがなく、Files／AirDrop／共有先、外部`.knit`の実機往復、WebViewの実行時ブリッジ表示は未確認。端末を用意したM5でXCUITestと機内モード試験が必要。
- 配布影響: `.knit`をFilesや他アプリから開くDocument Typeが追加された。署名、App Store Connect、TestFlight配布は行っていない。

## 2026-09-20: M2コミットのGitHub push再試行

- 変更: M2コミット`7d23982`のpushを実行した。
- 検証: `git push origin main`は2回ともGitHubの443番ポートへの接続失敗で未反映となった（`Failed to connect to github.com port 443`）。ローカル作業ツリーは変更なしで、リモートは直前の`0ad827d`のまま。
- 未実施: GitHub上の反映確認。ネットワーク接続が復旧するまで再試行が必要。
- 配布影響: なし。TestFlight・App Store配布は行っていない。

## 2026-09-20: M2 scene phase通知とバックグラウンド保存flushを接続

- 変更: SwiftUIのscene phaseがinactive/backgroundへ移行したとき、`WebViewModel`から`knittingEditorAppWillResignActive`イベントをWeb側へ通知し、Web編集画面がdirtyな盤面を即時IndexedDBへ保存するようにした。保存成功時は保存状態を解除し、失敗時は`.knit`バックアップを促すメッセージを表示する。
- 主なファイル: `App/KnittingEditorApp.swift`、`App/WebViewContainer.swift`、`Web/src/App.tsx`、`DEVELOPMENT.md`、`TODO.md`
- テスト: `(cd Web && npm test)`で4ファイル22テスト成功、`npm run build`と`scripts/build-web.sh`でTypeScript/Viteビルド成功。イベント経路のSimulator・実機動作は未実施。
- 検証: `xcodegen generate --spec project.yml`成功、iOS Simulator向け`xcodebuild -project knittingEditor.xcodeproj -scheme knittingEditor -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build`成功。`AppResources/Web/`はXcode pre-build scriptで再生成される。
- 未実施: Simulator・実機でのscene phase、強制終了相当、IndexedDB復元、保存失敗時のUI確認。利用可能なSimulatorデバイスがないため。
- 配布影響: TestFlight・App Store配布は行っていない。

## 2026-09-20: M1 Web版編集資産をアプリ用ビルドへ同期

- 変更: Web版固定コミット`8d3385799f61526334fd33c0a9e7be115f084afd`からReact UI、packed Board、Canvas、26記号の`catalog.ts`・`glyphs.ts`、IndexedDB、PNG/PDF、`.knit`入出力、使い方ページを`Web/`へ同期した。`scripts/build-web.sh`でVite成果物を`AppResources/Web/`へ生成し、Xcodeのpre-build scriptからも同じ処理を実行する。
- アプリ差分: Google Analytics初期化と外部プライバシーURLを除去し、分析APIはno-opにした。Safariの`localStorage`旧版移行関数とテストをアプリ版から除外した。同期記録とIDスナップショットを`docs/WEB_SYNC.md`へ追加した。
- 主なファイル: `Web/`、`scripts/sync-web-source.sh`、`scripts/build-web.sh`、`project.yml`、`AppResources/Web/.gitkeep`、`docs/WEB_SYNC.md`、`TODO.md`
- テスト: `(cd Web && npm test)`で4ファイル22テスト成功、`npm run build`（`scripts/build-web.sh`内）でTypeScriptとViteビルド成功。生成bundleにGAタグ、アプリ外部ホスト、`localStorage`移行文字列がないことを確認した。`xcodegen generate --spec project.yml`とiOS Simulator向け`xcodebuild ... build`も成功し、アプリバンドル内`Web/`へHTML、CSS、JavaScript、PDF Worker、使い方ページが入ることを確認した。
- 検証: Web版のGit状態はcleanのまま維持し、同期スクリプトは固定SHAとclean checkoutを検査する。誤って付けたVitestの`--runInBand`オプションは失敗したため、正しい`npm test`を再実行して成功を確認した。
- 未実施: Simulatorでの起動・WebView内操作、実機、機内モードでの通信監視、Files／共有シート、Swiftブリッジ、Web→アプリ→Webの実データ往復。利用可能なSimulatorデバイスがなく、ネイティブ連携はM3以降の実装対象であるため。
- 配布影響: TestFlight・App Store配布は行っていない。生成Web bundleはGit管理せず、ビルド時に再生成する。

## 2026-09-20: M0 SwiftUI・ローカルWKWebView基盤を追加

- 変更: iOS 17.0以上のiPhone・iPadを対象に、SwiftUIアプリ入口、固定origin（`knitting-local://bundle`）の`WKURLSchemeHandler`、永続`WKWebsiteDataStore`を使う`WKWebView`コンテナを追加した。Web資産はアプリバンドルへ同梱し、外部URLへのナビゲーションを拒否する。M0検証用Web画面でCanvas、Pointer Events、Blob、IndexedDB、module Workerの利用可否を確認でき、IndexedDBの保存回数とscene phaseからの保存要求を表示する。
- 主なファイル: `project.yml`、`knittingEditor.xcodeproj`、`App/KnittingEditorApp.swift`、`App/WebViewContainer.swift`、`App/LocalWebSchemeHandler.swift`、`AppResources/Web/*`、`Tests/KnittingEditorAppTests/LocalWebSchemeHandlerTests.swift`
- 開発規則: `AGENTS.md`の構成表を更新し、M0の技術検証fixtureは直接編集可、M1以降の生成Webバンドルは直接編集禁止と明記した。
- 方針更新: 対象OS下限をiOS 17.0に決定し、`DEVELOPMENT.md`、`SPECIFICATION.md`、`README.md`、`TODO.md`を同期した。実際のWeb版編集機能の同期はM1で行う。
- テスト: `LocalWebSchemeHandlerTests`を追加した。`xcodebuild ... build-for-testing`でアプリ・テストターゲットのコンパイルに成功し、ビルド成果物に`index.html`、`app.js`、`worker.js`、`styles.css`が含まれることを確認した。`node --check`でM0用JavaScript 2ファイルの構文を確認した。
- 検証: `xcodegen generate --spec project.yml`成功、`xcodebuild -project knittingEditor.xcodeproj -scheme knittingEditor -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build`成功、同じ設定の`build-for-testing`成功、`xcrun simctl list devices available`で利用可能なSimulatorデバイスを確認した。
- 未実施: Simulatorでの起動・XCTest実行、機内モード、実機のiPhone・iPad、IndexedDBの再起動復元、module Workerの実行確認。現在の環境には利用可能なSimulatorデバイスが表示されず、実機操作もこの作業では行っていないため。
- 配布影響: App Store・TestFlightへの配布は行っていない。Bundle IDは`com.k0mork.knittingEditor`を仮設定しており、Apple Developer Teamと署名方式の確定が必要。

## 2026-09-20: iOS・iPadOS移行計画と開発規則を作成

- 変更: オフライン完結のローカル`WKWebView`方式、Safari保存領域を移行しない方針、`.knit`互換、Web版記号カタログ同期、段階的な実装計画を定義した。
- 主なファイル: `README.md`、`DEVELOPMENT.md`、`SPECIFICATION.md`、`TODO.md`、`AGENTS.md`
- 基準: Web版 `/Users/komorikouki/git/knittingEditor` のコミット`8d33857`、`STITCH_CATALOG_VERSION = 3`、26記号を読み取り専用で確認した。
- GitHub: 公開リポジトリ`https://github.com/K0mork/knittingEditor_app.git`を正式な`origin`とし、変更ごとのpushを必須化した。初回コミット`a506b05`を`main`へpushし、ローカルHEADと`refs/heads/main`が一致することを確認した。
- テスト: なし。アプリコードとXcodeプロジェクトはまだ存在しない。
- 検証: `wc -l`と`rg`で文書内容・基準コミット・オフライン要件・GitHub URLを確認した。`git diff --cached --check`に合格し、`git ls-remote origin refs/heads/main`でpush結果を確認した。Web版は`git status --short --branch`で変更なしを確認した。
- 未実施: ビルド、単体テスト、Simulator・実機試験。実行対象コードが未作成のため。
- 配布影響: なし。設計文書のみで、アプリのビルド・配布は行っていない。
