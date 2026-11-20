# 2026-11-19 — 文字サイズ変更直後の操作メニュー位置測定を、大きな文字のレイアウト反映後にする

- 影響: `tests/e2e/layout-focus-and-hover.spec.ts`は、ルートの文字サイズを書き換えた直後に`.action-bar`の位置を測っており、非同期の大きな文字向けレイアウト（`data-large-text`）の反映前の位置を測ったまま、反映後の位置と比べてまれに失敗する（#425）。測定の前に、予定した`data-large-text`の付け外しと操作帯の位置が落ち着くのを待つように直し、アプリの実装は変えていない。
- 主なファイル: `tests/e2e/layout-focus-and-hover.spec.ts`
- テスト: 既存のE2Eテストの測定手順を直した。新しいテストは追加していない。
- 検証:
  - `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`が成功した。
  - `npx playwright test tests/e2e/layout-focus-and-hover.spec.ts --repeat-each 10 --workers 8`が390件成功した。
  - このブランチで`npm run test:e2e`（Chromiumモバイル・デスクトップ、WebKitモバイル）を3回実行し、いずれもすべて成功した（689件成功、WebKitのみ・Chromiumのみのテストはいつも通りスキップ）。
  - 同じ日、この修正を含まないブランチでは、フル並列実行の`layout-focus-and-hover.spec.ts`の同じ比較が失敗した（1024〜1280px幅で28px・48pxの文字）ので、#425の原因と一致する。
- デプロイ影響: なし（テストのみ）。
