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
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md): 完了した変更と検証記録
- [AGENTS.md](AGENTS.md): このリポジトリで作業する開発者・エージェント向けの必須規則

## 現在の状態

- 実装済み範囲: M0のSwiftUI・WKWebViewコンテナ、M1のWeb編集資産同期、M2のライフサイクル保存、M3のFiles／共有ブリッジ、M4のアプリ内ダイアログ、M5のCI／XCUITest基盤、M6のPrivacy Manifest／審査文書とSimulator用スクリーンショット下書き
- Simulator検証: iPhone 16／iPad (10th generation)でXCTest・XCUITest 12件、PNG／PDF／`.knit`保存導線、編集後の再起動復元を確認済み
- 未完了P0: Apple署名、実機の通信・ジェスチャー・アクセシビリティ・性能検証、Files実保存／共有先選択、TestFlight、App Store Connect提出
- Xcodeプロジェクト: `knittingEditor.xcodeproj`を作成済み
- 対象OSの下限: iOS 17.0以上
- App Store Connect設定: 未作成

Web編集画面はM1で同梱済みです。M3でFiles・共有シート・`.knit`入出力のネイティブ連携を追加しました。実機でのFiles／AirDrop往復試験はM5で行います。
