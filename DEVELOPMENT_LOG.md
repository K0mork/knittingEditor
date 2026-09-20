# Development Log

ユーザーに見える機能、挙動、データ形式、移行、テスト・ビルド設定、配布設定の変更を、新しいものから順に記録します。文書だけの変更でも、方針・仕様・運用規則を変えた場合は記録します。

各項目には次を含めます。

- 日付と要約
- 変更した挙動・方針と主なファイル
- 追加・更新したテスト
- 実行した検証コマンドと結果
- 未実施の検証と理由
- 配布への影響

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
