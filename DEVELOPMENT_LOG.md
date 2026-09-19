# Development Log

## 2026-09-19 — 編集から出力までの利用分析を追加

- 影響: GA4でエディタ準備、初回編集、機能パネル、編み目選択、新規作成、ブロック利用、PNG/PDF出力、バックアップ、処理失敗を分析できるようにした。編み図名・ファイル名・文書IDは送信せず、自動テストでは計測を無効化する。表示と操作手順は変更しない。
- 主なファイル: `src/analytics.ts`, `src/analytics.test.ts`, `src/main.tsx`, `src/App.tsx`
- GA4設定: Search Consoleを連携し、イベントデータ保持を14か月に変更した。8個のイベントスコープ カスタムディメンションを登録済み。`chart_exported` のキーイベント化は初回の本番イベント受信後に行う。
- テスト: `src/analytics.test.ts` に本番限定の初期化、重複防止、イベント送信、初回編集の一度だけの送信、低カーディナリティ区分のテストを追加した。
- 検証: `npm run typecheck`、`npm test`（13件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 静的アプリの更新あり。デプロイ後にGA4 DebugViewまたはリアルタイムでイベントとパラメータを確認し、`chart_exported` のキーイベント集計を確認する必要がある。

## 2026-09-19 — 盤外からの無効な範囲選択を防止

- 影響: 行列ラベルなど盤外から範囲選択を開始しても、0行・0列の不正なブロックを作成しないようにした。盤内での範囲選択動作は変更しない。
- 主なファイル: `src/model/Board.ts`, `src/canvas/BoardCanvas.tsx`
- テスト: `src/model/Board.test.ts` に盤外選択の境界テストを追加した。
- 検証: `npm run typecheck`、`npm test`（9件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 静的アプリの更新あり。デプロイ後に盤内の範囲選択とブロック作成を確認する必要がある。

## 2026-09-19 — 自動保存の競合を修正

- 影響: 保存処理中に追加された編集を未保存扱いに戻さず、別の編み図へ切り替えた後に古い保存結果で表示を戻さないようにした。
- 主なファイル: `src/App.tsx`
- テスト: `tests/e2e/editor.spec.ts` の永続化確認を実セル内容まで強化した。
- 検証: `npm run typecheck`、`npm test`（9件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop、15件）を実行し、すべて成功。
- デプロイ影響: 静的アプリの更新あり。デプロイ後に編集・自動保存・再読込みを確認する必要がある。
