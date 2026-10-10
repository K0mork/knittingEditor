# 2026-10-10 — 記号と正常なブロックを含む回帰テスト

- 影響: #194（Closes #194）。空の盤面だけでは検出できなかったコピー貼り付け・PNG・全データバックアップの退行を検証する。製品コードと利用者の挙動は変更しない。
- 主なファイル: `tests/e2e/editor.spec.ts`、`packages/editor-core/export/exporters.test.ts`、`packages/editor-core/storage/database.test.ts`、`ios/Web/src/backupInterchange.test.ts`。
- テスト: 色付きの表目・2マス記号・白くするセルを画面で配置し、別の位置への繰り返し貼り付け、元のセルの保持、元に戻すをセル配列全体で検証。PNGの実画素と復元ブロックの貼り付けをE2Eに追加。VitestではCanvasスタブで実際のdrawCell・drawGlyphを通し、色・位置・2マスの線・白い塗りと空盤面との差を検証。共通とiOS Webで、名前・寸法・色・2マス記号を持つブロックの全体バックアップ往復、新ID、既存データ保持、個別バックアップのブロック除外を検証。
- 検証:
- `npm ci`：成功。
- `npm run typecheck`：成功。
- `npm test`：成功（37ファイル、261件）。
- `npm run build`：成功。
- `npm run check:dist`：成功。
- `(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`：成功。
- `(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`：成功（8ファイル、34件）。
- `npx playwright test --list`：初回はヘルパー名の重複で失敗。重複を修正し、再実行成功（171件の一覧）。ブラウザ実行はしていません。
- `git diff --check`：成功。
- 未実行: `npm run test:e2e`のChromium・WebKit実行はsandboxでブラウザを起動できないため検証担当に任せる。コピー内容を空にする、drawCell呼び出しを省く、全体バックアップからブロックを落とす変更に対する失敗確認も検証担当に依頼する。iOSのビルド、iPhone/iPad Simulator、アプリ更新、unsigned Release Archive、オフライン同梱物検査はPR CIに任せる。
- デプロイ影響: none。テストのみの変更のため、追加の配信後確認は不要。
