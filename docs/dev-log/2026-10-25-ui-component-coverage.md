# 2026-10-25 — 共通UIの未検証分岐を単体テストで保護

- 影響: モーダルのTab循環、ドロワーのフォーカス移動と復帰、縮小画像の遅延描画とObserver破棄、盤面設定、PDF出力設定の既存動作をテストで保護する。実装・見た目・保存形式は変更しない。
- 主なファイル: `packages/editor-core/ui/hooks.test.tsx`、`DocumentList.test.tsx`、`GridControls.resize.test.tsx`、`ExportControls.layout.test.tsx`。
- テスト: 可視・有効要素だけのTab/Shift+Tab循環、見出しへの移動・入力フォーカス維持・起動ボタンへの復帰、画面外での非描画・文書更新時とunmount時のdisconnect、四辺の追加と既存記号の位置、指定位置の入力拒否と取消、全体クリアの確認／取消、100ページ超の警告・A4横の出力引数を追加。四辺の削除は既存テストで確認。
- 検証環境: ローカルNode.jsは26.8.1（`node --version`: `v26.8.1`）、CIはNode 24。
- 検証:
  - `npx vitest run packages/editor-core/ui/hooks.test.tsx packages/editor-core/ui/DocumentList.test.tsx packages/editor-core/ui/GridControls.resize.test.tsx packages/editor-core/ui/ExportControls.layout.test.tsx`: 4ファイル・35件成功。
  - `npm run typecheck`: 成功。
  - `npm test`: 70ファイル成功・2ファイル失敗、794件成功・2件失敗。既存の大盤面PDF生成が18894ms（上限15000ms）、縮小画像生成が307ms（上限250ms）で失敗。テスト条件・実装は変更しない。
  - `npm test -- --maxWorkers=2`: 再実行は72ファイル・796件すべて成功。初回は他の検証も並列実行していたため、負荷の影響が疑われるが原因は確定していない。
  - `npm run build`: 成功（70 modules transformed）。
  - `npm run check:dist`: 成功（dist verified: 2637.2 KiB）。
  - `ios/Web`で`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: 成功。
  - `ios/Web`で`../../node_modules/.bin/vitest run --config vite.config.ts`: 16ファイル・139件成功。
  - `git diff --check`: 成功。
- 再確認: コミット後に`npm run typecheck`（成功）、`npm test -- --maxWorkers=2`（796件成功）、`npm run build`・`npm run check:dist`（成功）、`npm run test:e2e`（全project、524件成功・7件スキップ）を実行した。
- 未実施: iOS Simulator・実機の検証とNode 24での実行は、PRのCIに任せる。
- デプロイ影響: なし。実装変更がないため、追加の本番操作確認は不要。
