# 2026-11-04 — 文書の記号件数をカタログと突き合わせる

- 影響: 利用者向け文書・SEOメタデータに直書きされた編み目記号の件数が、`STITCHES` の件数と一致することをテストで検査するようにした。`docs/WEB_SYNC.md` の永続記号IDの範囲表記は、ID追加時に更新が必要な数字をなくした。
- 主なファイル: `scripts/stitch-count.test.mjs`、`docs/WEB_SYNC.md`
- テスト: `scripts/stitch-count.test.mjs` を追加した。README、トップページ、`llms.txt`、Web/iOSの使い方、iOS仕様・開発文書、SEO E2Eの「29種類」「29記号」を `STITCHES.length` と比較する。
- 検証: `npx vitest run scripts/stitch-count.test.mjs scripts/guide-content.test.mjs scripts/japanese-punctuation.test.mjs` を実行する。worktreeではワークスペースのWorker解決の都合で全体の`npm test`を実行しないため、PR CIで全体を確認する。
- デプロイ影響: なし（文書とテストのみ）。
