# Development Log

ユーザーに見える機能、挙動、データ形式、移行、テスト・ビルド設定、配布設定の変更を、新しいものから順に記録します。文書だけの変更でも、方針・仕様・運用規則を変えた場合は記録します。

各項目には次を含めます。

- 日付と要約
- 変更した挙動・方針と主なファイル
- 追加・更新したテスト
- 実行した検証コマンドと結果
- 未実施の検証と理由
- 配布への影響

## 2026-09-20: iOS・iPadOS移行計画と開発規則を作成

- 変更: オフライン完結のローカル`WKWebView`方式、Safari保存領域を移行しない方針、`.knit`互換、Web版記号カタログ同期、段階的な実装計画を定義した。
- 主なファイル: `README.md`、`DEVELOPMENT.md`、`SPECIFICATION.md`、`TODO.md`、`AGENTS.md`
- 基準: Web版 `/Users/komorikouki/git/knittingEditor` のコミット`8d33857`、`STITCH_CATALOG_VERSION = 3`、26記号を読み取り専用で確認した。
- GitHub: 公開リポジトリ`https://github.com/K0mork/knittingEditor_app.git`を正式な`origin`とし、変更ごとのpushを必須化した。
- テスト: なし。アプリコードとXcodeプロジェクトはまだ存在しない。
- 検証: Markdownファイルの内容確認、リンク対象ファイルの存在確認、Git差分確認を実施する。
- 未実施: ビルド、単体テスト、Simulator・実機試験。実行対象コードが未作成のため。
- 配布影響: なし。設計文書のみで、アプリのビルド・配布は行っていない。
