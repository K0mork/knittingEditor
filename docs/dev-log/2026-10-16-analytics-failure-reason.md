# 2026-10-16 — 操作失敗の固定分類とWeb版の識別子

- 影響: #280。Webの全製品イベントへ公開版の短いコミット識別子 `app_build` を付与し、`operation_failed` へ `failure_reason` を追加。文面・ファイル名などは送らず、型から固定分類だけを得る。GA4自動イベントは変更しない。iOSは引き続き分析を送らない。
- 主なファイル: `packages/editor-core/analyticsFailure.ts`、`storage/backupErrors.ts`、`storage/backupCodec.ts`、`storage/backup.worker.ts`、`storage/backupTask.ts`、`storage/database.ts`、`util/workerStarter.ts`、`state/useEditorSession.ts`、`ui/useEditorController.ts`、`src/analytics.ts`、`vite.config.ts`、`scripts/app-build.mjs`、`public/privacy/index.html`、`ios/docs/WEB_SYNC.md`。
- 分類: `site_updated`、`worker_start`、`worker_error`、`storage_quota`、`storage`、`invalid_backup`、`backup_limit`、`unknown`。既知のバックアップ型だけWorkerの固定コードで往復し、その他の処理失敗は `worker_error`。保存系DOMExceptionは名前で容量不足とその他を区別する。
- テスト: 全分類、DOMException、Worker起動と処理の型、実際のバックアップWorkerハンドラとコード復元、codecの型、初期化・管理操作・出力の失敗分類、first_editを含む版識別子付与と上書き防止、CI・ローカル・git失敗時の識別子取得を追加・更新。
- 検証: Node v26.8.1（CI指定はNode 24）。`npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist` は成功。`ios/Web` 内で `../../node_modules/.bin/tsc -b --pretty false`、`../../node_modules/.bin/vitest run`、`../../node_modules/.bin/vite build` は成功。`find ios/Web/dist -type f -exec grep -nE '(^|[^[:alnum:]_])(fetch|XMLHttpRequest|WebSocket|EventSource)[[:space:]]*\(' {} +` は一致なし。`git diff --check` は成功。Playwright E2E・GUI・Simulatorは実行不可のためリード担当。PR/full iOS CIは未実行。
- デプロイ影響: マージ・配信は未実施。配信するとWeb製品イベントに分類と版識別子が加わる。配信後は対象イベントの固定値と公開版識別子を確認する。GA4レポート用のカスタムディメンション登録は利用者が行う。
