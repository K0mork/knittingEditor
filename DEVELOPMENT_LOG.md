# Development Log

ユーザーに見える機能、挙動、データ形式、移行、テスト・ビルド設定、配布設定の変更を、新しいものから順に記録します。文書だけの変更でも、方針・仕様・運用規則を変えた場合は記録します。

各項目には次を含めます。

- 日付と要約
- 変更した挙動・方針と主なファイル
- 追加・更新したテスト
- 実行した検証コマンドと結果
- 未実施の検証と理由
- 配布への影響

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
