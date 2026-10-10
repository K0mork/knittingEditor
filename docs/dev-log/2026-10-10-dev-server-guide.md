# 2026-10-10 — 開発サーバーで静的ページのディレクトリURLを配信

- 影響: `/guide/`、`/support/`、`/privacy/`など、`public/`配下に`index.html`があるディレクトリURLを、開発時にも静的ページとして配信する。Closes #216。
- 主なファイル: `vite.config.ts`、`scripts/public-directory-index.mjs`、`scripts/public-directory-index.d.mts`。
- テスト: `scripts/public-directory-index.test.mjs`でディレクトリURL、クエリ、明示的なindex.html、HEAD、ルート・存在しないディレクトリの編集画面へのフォールバック、静的アセットを確認。`tests/e2e/dev-guide.spec.ts`で実際の開発サーバーに対する編集画面から使い方への遷移と再読み込みを追加。
- 検証: `npm ci`成功。Node v24.21.0をPATHに設定し、`npm run typecheck`、`npm test`（38ファイル、263件）、`npm run build`、`npm run check:dist`成功。`npm run dev -- --host 127.0.0.1 --port 5419 --strictPort`で起動し、`curl -fsS http://127.0.0.1:5419/guide/ | cmp - public/guide/index.html`、support・privacyの同じ比較が成功。`curl -fsS http://127.0.0.1:5419/ | rg '/@vite/client'`成功。`cat dist/CNAME`、`rg -n '<title>|/assets/' dist/index.html dist/guide/index.html`でドメイン・本番HTMLを確認。`git diff --check`成功。PATH既定のNode v26では一度全件成功し、その後の実行では変更対象外のthumbnail・PDFの性能テストが時間上限で失敗したため、指定のv24で全件再確認した。追加テストの単独実行`node_modules/.bin/vitest run scripts/public-directory-index.test.mjs`も4件成功。
- 未実施の検証: Playwrightはサンドボックスでブラウザーを起動できないため、Chromium・WebKitの`npm run test:e2e`を検証担当とPR CIに委ねる。iOSソース・共有コードに変更はなく、iOSビルド・Simulatorテストはローカルでは実施しない。必要なCIジョブはPR CIの判定に従う。
- デプロイ影響: none。開発時のみのプラグインで本番ビルドには適用しない。配信後に追加で必要な確認はなし。
