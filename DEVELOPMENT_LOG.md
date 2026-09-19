# Development Log

## 2026-09-19 — 自動保存の競合を修正

- 影響: 保存処理中に追加された編集を未保存扱いに戻さず、別の編み図へ切り替えた後に古い保存結果で表示を戻さないようにした。
- 主なファイル: `src/App.tsx`
- テスト: `tests/e2e/editor.spec.ts` の永続化確認を実セル内容まで強化した。
- 検証: `npm run typecheck`、`npm test`（9件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 静的アプリの更新あり。デプロイ後に編集・自動保存・再読込みを確認する必要がある。
