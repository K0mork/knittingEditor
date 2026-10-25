# 2026-10-25 — タッチ編集中の盤面保護とピンチ基準の更新

- 影響: タッチ描画・消去の開始後に盤面またはリビジョンが変わった場合、その筆を破棄して切り替え・復元・Undo後の内容を保護する。指の追加・終了時にピンチ基準を更新し、3本指から2本指へ戻った際の倍率の跳びを防ぐ。暫定盤面は実際の描画・消去の直前に作り、接触だけのピンチや空マスの消去では複製しない。見た目と保存形式は変更しない。
- 主なファイル: `packages/editor-core/canvas/BoardCanvas.tsx`、`packages/editor-core/canvas/BoardCanvas.input.test.tsx`
- テスト: 盤面切替・外部リビジョン変更（描画／消去、移動あり／なし）、複製の遅延、ピンチ指の交代後の倍率・位置維持の回帰テストを追加。既存の2本目による取消も継続確認。
- 検証: ローカルNodeは26.8.1、CIはNode 24。
  - `npx vitest run packages/editor-core/canvas/BoardCanvas.input.test.tsx`: 初回29成功・1失敗（浮動小数点の完全一致比較）。近似比較へ修正して再実行し30成功。最終コードは後述の全体テストでも成功。
  - `npm run typecheck`: 成功（再実行も成功）。
  - `npm test`: 初回792成功・1失敗（既存PDF性能テストが16.37秒で15秒上限超過）。再実行で71ファイル・793テストすべて成功。
  - `npm run build`: 成功。
  - `npm run check:dist`: 成功、`dist verified: 2640.2 KiB`。
  - `ios/Web`で`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: 成功。
  - `ios/Web`で`../../node_modules/.bin/vitest run --config vite.config.ts`: 16ファイル・139テスト成功。
  - `git diff --check`: 成功。
  - 追加したテストは変更前の`BoardCanvas.tsx`で10件失敗することを確かめた。
  - コミット後に`npm test -- --maxWorkers=2`（793件成功）と`npm run test:e2e`（全project、524件成功・7件スキップ）を実行した。
  - iOS Simulator・実機は手元で実行していない。PRのCIと、このブランチで手動実行する`ios-full.yml`に任せる。
- デプロイ影響: マージ後Web配信とiOS Web bundleへ反映される。今回は配信なし。配信後は盤面切替中のタッチ取消と複数指ピンチを確認する。iPadOSの3本指システムジェスチャ配送は実機未確認。
