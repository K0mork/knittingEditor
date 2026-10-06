# 開発ログ

変更の記録は、PRごとにこのディレクトリへ1ファイルを足して書く。PRを並行して進めても、記録どうしがコンフリクトしない。何を記録するかはルートの`AGENTS.md`の「Development Log」に従う。

2026-10-06までの記録はルートの`DEVELOPMENT_LOG.md`、リポジトリ統合前のアプリの記録は`ios/DEVELOPMENT_LOG.md`にあり、どちらも追記しない。

## ファイル名

`YYYY-MM-DD-<slug>.md`。日付はPRを作った日、slugはブランチ名から種類の接頭辞を除いたもの。

- `fix/preserve-grid-after-resize` → `2026-10-06-preserve-grid-after-resize.md`

ファイル名の順に並べると古い順になる。新しい順に読むときは`ls -r docs/dev-log`を使う。

## 書式

```markdown
# YYYY-MM-DD — 短い要約

- 影響: 変わった挙動と、その理由
- 主なファイル: `path/to/file`
- テスト: 追加・更新したテスト
- 検証: 実行したコマンドと結果。手元で実行しなかった検証と、その理由やPRのCIに任せたこと
- デプロイ影響: なし／Pagesへ配信される、など。配信後に確かめること
```

PRのCIで直したことは、同じファイルに書き足す。ほかのPRのファイルは編集しない。
