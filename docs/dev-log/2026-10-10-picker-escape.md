# 2026-10-10 — 記号・色の選択をフォーカス移動後もEscapeで閉じる

- 影響: Closes #205。編み目記号・記号の色の見出しや余白をクリックしてフォーカスがbodyへ移ったあとも、Escapeで閉じて開いたボタンへ戻る。共通フックで開いているモーダルを管理し、最前面だけがEscapeを処理する。IME変換中、処理済みのキー、外部の入力欄、別のダイアログ、ネイティブの色入力には干渉しない。入力ダイアログ内の通常のEscapeキャンセルとTabの循環は維持する。
- 主なファイル: `packages/editor-core/ui/hooks.ts`、`packages/editor-core/ui/hooks.test.tsx`、`tests/e2e/picker-escape.spec.ts`。
- テスト: Vitestで最前面のみの処理、IME、入力欄、別のダイアログ、処理済みキー、フォーカス復帰とリスナー解除を追加。Playwrightで両ピッカーの開いた直後・見出しクリック後・余白クリック後のEscapeと復帰先を追加。
- 検証: `npm ci`、`npm run typecheck`、`npm run build`、`npm run check:dist`は成功。`npm test`は初回に既存の`thumbnail.test.ts`の速度上限テストが失敗し、ほかのチェックとの並列実行を避けた再実行で38ファイル・260テストすべて成功。`(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`と`(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`は成功（34テスト）。`npx playwright test tests/e2e/picker-escape.spec.ts --list`で全3プロジェクト・6テストの検出を確認。`git diff --check`は成功。サンドボックスでブラウザー・Simulatorを起動できないためE2E実行は検証担当、iOSのビルド、iPhone/iPad Simulator、更新テスト、Release Archive、オフラインバンドル検査はPR CIに委ねる。
- デプロイ影響: Web共通コードがPagesとiOSの組み込みWebへ反映される。配信後は両ピッカーの見出し・余白クリック後にEscapeで閉じ、開いたボタンへフォーカスが戻ることを確認する。
