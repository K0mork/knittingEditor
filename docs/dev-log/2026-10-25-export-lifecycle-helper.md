# 2026-10-25 — PNG/PDF出力の共通ライフサイクルを整理

- 影響: Web/iOS共通コントローラーの生成・ファイル受け渡し・分析・共有取消・失敗通知・busy解除を内部関数へ集約。利用者向けの挙動・文言・イベントは維持。PNGサイズ検証とPDFだけの通知クリアは各入口に残す。
- 主なファイル: `packages/editor-core/ui/useEditorController.ts`、`packages/editor-core/ui/useEditorController.test.tsx`
- テスト: PNG/PDFのファイル受け渡しが失敗したとき、形式別busy表示、busy解除、再読込案内、形式別失敗イベント、成功イベントを送らないことを追加検証。既存テストの期待値は変更していない。
- 検証:
  - `node -v`: v26.8.1。ローカル Node は 26.8.1、CI は Node 24。
  - `npm run typecheck`: 成功（`tsc -b --pretty false`）。
  - `npm test`（初回）: `Test Files 1 failed | 70 passed (71)`、`Tests 1 failed | 784 passed (785)`。変更対象外の `model/thumbnail.test.ts:105` の速度検証が 252.73ms / 上限250msで失敗。
  - `npm test`（再実行）: `Test Files 2 failed | 69 passed (71)`、`Tests 2 failed | 783 passed (785)`。同じサムネイル検証が580.26ms / 上限250ms、`export/pdf.worker.test.ts:84` の速度検証が18089.41ms / 上限15000msで失敗。原因は確定しておらず、対象外ファイルは変更していない。
  - `npx vitest run packages/editor-core/ui/useEditorController.test.tsx packages/editor-core/ui/useEditorController.progress.test.tsx`: `Test Files 2 passed (2)`、`Tests 52 passed (52)`。
  - `npm run build`: 成功（`✓ built in 712ms`）。
  - `npm run check:dist`: 成功（`dist verified: 2636.0 KiB`）。
  - `ios/Web` で `../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: 成功。
  - `ios/Web` で `../../node_modules/.bin/vitest run --config vite.config.ts`: `Tests 139 passed (139)`。
  - `git diff --check`: 成功。
- 再確認: 上の速度検証の失敗は、ほかの作業でマシンの負荷が高いときに起きた。コミット後に`npm test -- --maxWorkers=2`を実行し、71ファイル・785件すべて成功した。`npm run test:e2e`（全project）は524件成功・7件スキップ。
- 未実施: iOSネイティブの検証は手元で実行していない。PRのCIに任せる。
- デプロイ影響: 公開・配布操作なし。統合後はWeb/アプリの共通処理に反映される。Pages・TestFlight・App Storeの設定変更なし。配信後はPNG/PDF保存・取消・失敗通知を確認する。
