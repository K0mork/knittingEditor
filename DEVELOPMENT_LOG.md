# Development Log

ユーザーに見える機能、挙動、データ形式、移行、テスト・ビルド設定、配布設定の変更を、新しいものから順に記録します。文書だけの変更でも、方針・仕様・運用規則を変えた場合は記録します。

各項目には次を含めます。

- 日付と要約
- 変更した挙動・方針と主なファイル
- 追加・更新したテスト
- 実行した検証コマンドと結果
- 未実施の検証と理由
- 配布への影響

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
