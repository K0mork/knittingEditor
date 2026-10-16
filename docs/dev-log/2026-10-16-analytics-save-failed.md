# 2026-10-16 — 端末内保存の失敗を計測

- 影響: #281。Webで端末内保存が失敗すると`save_failed`を送り、保存成功までは追加の失敗を送らない。既存の通知は維持し、成功時のイベントは送らない。iOSは従来どおり`NO_ANALYTICS`で外部送信しない。
- 主なファイル: `packages/editor-core/ui/useEditorController.ts`、`packages/editor-core/state/useEditorSession.ts`、`public/privacy/index.html`。セッションの任意の`onSaveSuccess`で抑制を同期的に解除し、Reactの再描画のタイミングに依存させない。プライバシー表へ行を追加し、既存の改定日は維持。
- テスト: `packages/editor-core/ui/useEditorController.test.tsx`で各保存トリガーの送信内容、編集やトリガーが変わっても続く抑制、保存成功後の再送、同一act内の復旧、分析省略時の通知・未保存状態の維持を検証。
- 検証: Node v26.8.1（CI指定はNode 24）。`npm run typecheck`、`npm test`（67ファイル・647テスト）、`npm run build`、`npm run check:dist`が成功。`cd ios/Web`で`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`、`../../node_modules/.bin/vitest run --config vite.config.ts`（15ファイル・132テスト）、`../../node_modules/.bin/vite build`が成功。PythonでiOS Web生成JSに禁止通信API文字列がないこと、Web生成物の追加行・改定日の非重複・CNAMEを確認。`git diff --check`成功。Playwright E2Eはブラウザ起動不可のためリード担当へ委ねる。Simulator・PR/full CIは未実行。
- デプロイ影響: マージ・配信時にWebの新イベントとプライバシー表が反映される。本作業では配信なし。配信後に保存失敗のイベント、成功までの抑制と復旧後の再送を確認する。共有コードのためiOS PR/full CIも要確認。
