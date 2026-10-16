# 2026-10-16 — エージェントのブラウザ検証をアクセス解析から除外

- 影響: Issue #282。Web本番でもUser-Agentに大文字・小文字を区別した`Claude/`を含む場合、またはlocalStorageの`knitting-editor:analytics-opt-out`が`1`の場合はGA4を初期化しない。保存領域へのアクセス例外はオプトアウトなしとして扱う。新しい情報の送信はなく、プライバシーポリシーとiOS・共通コードは変更しない。
- 主なファイル: `src/analytics.ts`、`src/analytics.test.ts`、`AGENTS.md`
- テスト: 純粋な送信判定、本番・開発環境、webdriver、ClaudeのUser-Agent、手動オプトアウトによるスクリプト・イベント抑止、通常ブラウザ、完全一致しない設定値、保存領域の取得・読み取り例外を検証。
- 検証: Node v26.8.1（CI指定はNode 24）。`npm run typecheck`成功。`npm test`は初回、jsdomにwebdriverプロパティがなく追加テストが失敗したため、navigatorのモックを修正して再実行し、64ファイル・634テスト成功。`npm run build`成功。`npm run check:dist`成功（dist verified: 2512.9 KiB）。`git diff --check`成功。`npm run test:e2e`は453件成功、6件スキップ（既存）。CIと実サイトの確認はPRのCIと配信後に行う。
- デプロイ影響: Pages配信後のWeb解析初期化条件が変わる。配信後は除外ブラウザと手動オプトアウトでタグを読み込まないことを確認する。手動設定は初期化時に読むため、コンソールで設定後に再読み込みしてから検証する。iOSへの影響なし。
