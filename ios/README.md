# knittingEditor for iOS / iPadOS

Web版「棒針編み図エディタ」を、インターネット接続なしで利用できるiOS・iPadOSアプリとして配布するためのプロジェクトです。

正式な統合先: <https://github.com/K0mork/knittingEditor>

旧アプリリポジトリ <https://github.com/K0mork/knittingEditor_app> は削除せず、履歴参照用の読み取り専用リポジトリとして保持します。アプリ履歴は統合先の [`23d0f98`](https://github.com/K0mork/knittingEditor/commit/23d0f98) で `ios/` 以下へ取り込み、統合コミット [`53de110`](https://github.com/K0mork/knittingEditor/commit/53de110) で `main` に反映しました。

初期スケルトンはiOS 17.0以上のSwiftUIユニバーサルアプリで、固定originのローカル`WKWebView`へ同梱Web資産を読み込みます。実装の基準は統合先の`packages/editor-core`、記号カタログ `STITCH_CATALOG_VERSION = 4`、およびルートのCI／ビルド設定です。

## 基本方針

- 編集、保存、PNG/PDF生成、バックアップ復元をすべて端末内で完結させる。
- 実行時にWebサイト、CDN、API、Google Analyticsへ接続しない。
- Web版のReact、盤面モデル、Canvas描画、記号定義、PDF生成をアプリへ同梱して再利用する。
- Files、共有シート、アプリのライフサイクルはSwift側で統合する。
- SafariのIndexedDB・`localStorage`は読み込まない。
- Web版とのデータ交換には`.knit`ファイルを使用する。

## ドキュメント

- [DEVELOPMENT.md](DEVELOPMENT.md): 開発方針、構成、工程、検証方法
- [SPECIFICATION.md](SPECIFICATION.md): 機能仕様、データ互換、非機能要件
- [GitHub Issues](https://github.com/K0mork/knittingEditor/issues): 未完了の作業と完了条件（初回リリース分はマイルストーン[iOS 1.0](https://github.com/K0mork/knittingEditor/milestone/1)）
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md): 統合前の変更と検証記録（凍結アーカイブ）
- [AGENTS.md](AGENTS.md): このリポジトリで作業する開発者・エージェント向けの必須規則

## 現在の状態

- 実装済み範囲: SwiftUI・WKWebViewコンテナ、共通workspaceからのWeb bundle生成、ライフサイクル保存、Files／共有ブリッジ、アプリ内ダイアログ、CI／XCUITest基盤、Privacy Manifest／審査文書とSimulator用スクリーンショット下書き
- Simulator検証: CI（Xcode 26.6、iOS 26.5 Simulator）のiPhone 17／iPad (A16)でXCTest・XCUITest、PNG／PDF／`.knit`保存導線、編集後の再起動復元、アプリ更新後のIndexedDB復元を確認している（2026-10まではXcode 15.4、iPhone 16／iPad (10th generation)のiOS 18.2 Simulator）
- 実機検証: iPhone 17とiPad Air（第5世代）で署名ビルド、主要編集、保存、PNG・PDF・`.knit`のFiles保存と往復、Dynamic Type、iPad可変ウィンドウ、機内モード主要フローを確認済み。機内モード前後の通信監視はiPad Air（第5世代）で確認済み
- 未完了P0: Files異常系の残り、マウス／トラックパッド、iPadのPNG上限超過表示、提出ビルドでの再確認、TestFlightでのクラッシュ・メモリ警告・出力時間の確認（#26）、有料Apple Developer Programでの署名済みArchive、TestFlight、App Store Connect提出
- Xcodeプロジェクト: `knittingEditor.xcodeproj`を作成済み
- 対象OSの下限: iOS 17.0以上
- App Store Connect設定: 未作成

PRの検証（`.github/workflows/ci.yml`）は、変更範囲に応じてWeb E2E（Chromium・WebKit）、iOS Webの型検査・Vitest、iPhone 17の全単体テストと`ios/UITests/pr-smoke-ui-tests.txt`のUIスモークテスト、Debugオフラインbundle検査を実行する。App Store文書・UIスモーク一覧の静的検査は常時実行し、必要なジョブを`ci-gate`で必須にする。

全検証は別の`.github/workflows/ios-full.yml`で、関連するマージ後、毎晩（18:23 UTC）、手動実行時に行う。iPhone 17・iPad (A16)の全単体／UIテストとDebug bundle検査、両端末の`app_update`、unsigned Release Archiveとオフライン資産検査が対象で、Pagesのゲートには含めない。iPadのUI除外一覧は使わない。`main`・夜間の失敗は`bug`・`priority:P1`・`platform:ios`付きIssueを作成し、同名の未完了Issueがある場合は実行URLをコメントする。失敗は調査・修正する。

iOS・共通コードの完了確認には、マージ後のコミット、または変更を含む後続の`main`コミットで全検証の成功が必要。同じブランチの古いrunはキャンセルされるため、連続マージ時は変更を含む最新コミットで確認する。夜間runもその変更を含む必要がある。保存・移行、Files・共有、iPadのレイアウト・キーボード・回転、Swift・ビルド設定・依存、スモーク対象外テストなどリスクの高い変更は、マージ前にもfeatureブランチで全検証を手動実行し、そのSHAの全ジョブの成功を確認する。

Web編集画面、Files・共有シート、`.knit`入出力のネイティブ連携は実装済みです。残作業はマイルストーン[iOS 1.0](https://github.com/K0mork/knittingEditor/milestone/1)のIssue、実機で確認済みの範囲は[`docs/REAL_DEVICE_RELEASE_CHECKLIST.md`](docs/REAL_DEVICE_RELEASE_CHECKLIST.md)を正とします。
