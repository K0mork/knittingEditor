# knittingEditor for iOS / iPadOS

Web版「棒針編み図エディタ」を、インターネット接続なしで利用できるiOS・iPadOSアプリとして配布するためのプロジェクトです。

正式な統合先: <https://github.com/K0mork/knittingEditor>

旧アプリリポジトリ <https://github.com/K0mork/knittingEditor_app> は削除せず、履歴参照用の読み取り専用リポジトリとして保持します。アプリ履歴は統合先の [`23d0f98`](https://github.com/K0mork/knittingEditor/commit/23d0f98) で `ios/` 以下へ取り込み、統合コミット [`53de110`](https://github.com/K0mork/knittingEditor/commit/53de110) で `main` に反映しました。

初期スケルトンはiOS 17.0以上のSwiftUIユニバーサルアプリで、固定originのローカル`WKWebView`へ同梱Web資産を読み込みます。実装の基準は統合先の`packages/editor-core`、記号カタログ `STITCH_CATALOG_VERSION = 3`、およびルートのCI／ビルド設定です。

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
- [TODO.md](TODO.md): 実装順序と完了条件
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md): 統合前の変更と検証記録（凍結アーカイブ）
- [AGENTS.md](AGENTS.md): このリポジトリで作業する開発者・エージェント向けの必須規則

## 現在の状態

- 実装済み範囲: SwiftUI・WKWebViewコンテナ、共通workspaceからのWeb bundle生成、ライフサイクル保存、Files／共有ブリッジ、アプリ内ダイアログ、CI／XCUITest基盤、Privacy Manifest／審査文書とSimulator用スクリーンショット下書き
- Simulator検証: iPhone 16／iPad (10th generation)でXCTest・XCUITest、PNG／PDF／`.knit`保存導線、編集後の再起動復元、アプリ更新後のIndexedDB復元をCIで確認済み
- 実機検証: iPhone 17とiPad Air（第5世代）で署名ビルド、主要編集、保存、Files／共有の一部、iPad可変ウィンドウ、機内モード主要フローを確認済み
- 未完了P0: 機内モード前後の通信監視、残りの端末・アクセシビリティ・性能・Files往復確認、有料Apple Developer Programでの署名済みArchive、TestFlight、App Store Connect提出
- Xcodeプロジェクト: `knittingEditor.xcodeproj`を作成済み
- 対象OSの下限: iOS 17.0以上
- App Store Connect設定: 未作成

Web編集画面、Files・共有シート、`.knit`入出力のネイティブ連携は実装済みです。実機で確認済みの範囲と残作業は[`TODO.md`](TODO.md)および[`docs/REAL_DEVICE_RELEASE_CHECKLIST.md`](docs/REAL_DEVICE_RELEASE_CHECKLIST.md)を正とします。
