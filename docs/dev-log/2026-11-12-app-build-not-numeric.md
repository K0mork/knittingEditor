# 2026-11-12 — GA4の`app_build`が数値として記録されないよう、先頭に`g`を付ける

- 影響: 製品イベントに付ける`app_build`を、コミットの短い識別子（7文字）から、その先頭に`g`を付けた値（例: `g8e13233`）に変えた。GA4で`app_build`ごとに集計したところ、指数表記に見える識別子の版（`8e13233`と`250e612`）がどちらも`inf`と記録されていて、版を区別できなかった。数字だけの識別子も数値として扱われうるため、すべての版で英字から始まるようにした。識別子が取れないときの`unknown`は変えていない。静的なページのイベントは、もともと`app_build`を送らない。
- 主なファイル: `scripts/app-build.mjs`、`docs/ANALYTICS.md`、`docs/GA4_ANALYSIS.md`
- テスト: `scripts/app-build.test.mjs`の期待値を`g`付きに直し、指数表記や数字だけに見える識別子でも、数値として読めない値になることを確かめるテストを足した。
- 検証:
  - `npm run typecheck`、`npm test`（1140件成功）、`npm run build`、`npm run check:dist`が成功した。`dist/assets/`の編集画面のスクリプトで、`app_build`が`g`付きの値になっていることを確かめた。
  - 1回目の`npm run test:e2e`は696件中658件成功、37件スキップ、1件失敗した。失敗は`tests/e2e/layout-focus-and-hover.spec.ts`の「keeps selection and action controls separate」（chromium-mobile、1024x1024・48px）で、#425と同じ箇所だった。この変更は編集画面の配置に触れていない。そのspecだけを再実行すると13件とも成功し、`npm run test:e2e`をもう一度実行して659件成功・37件スキップ・失敗0件だった。
- デプロイ影響: あり（Pagesへ配信される）。配信後、翌日以降にGA4で`customEvent:app_build`ごとの`eventCount`を見て、新しい版の値が`g`付きで届いていることを確かめる。
