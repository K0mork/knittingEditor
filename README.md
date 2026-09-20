# knittingEditor for iOS / iPadOS

Web版「棒針編み図エディタ」を、インターネット接続なしで利用できるiOS・iPadOSアプリとして配布するためのプロジェクトです。

公開リポジトリ: <https://github.com/K0mork/knittingEditor_app>

現在は設計・計画段階です。実装の基準はWeb版リポジトリ `/Users/komorikouki/git/knittingEditor` のコミット `8d33857`、記号カタログ `STITCH_CATALOG_VERSION = 3` とします。

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

- アプリコード: 未作成
- Xcodeプロジェクト: 未作成
- 対象OSの下限: 実装開始時に決定
- App Store Connect設定: 未作成
