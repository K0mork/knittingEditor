# 2026-11-06 — Web版の編み図をiPhone・iPadアプリへ移す手順を案内する

## 影響

Web版で作った編み図をiPhone・iPadアプリへ移す流れを、次の3か所に追加した。

- Web版の使い方（`public/guide/index.html`）に「7. iPhone・iPadアプリへ編み図を移す」を追加した。書き出し（保存済みブロックも移すなら「全データを書き出す」、1枚だけなら「この編み図を書き出す」）、「ファイル」アプリへの届け方（同じiPhone・iPadのSafariでは「共有・保存」から「ファイルに保存」、パソコンではAirDrop・iCloud Drive・メールなど）、アプリの「バックアップから復元」または「ファイル」アプリでのタップ、既存の編み図を上書きせず「（復元）」付きで追加することを説明した。
- 同じ節で、アプリからWeb版へ移す逆の手順と、App Storeへのリンクも案内した。新しいページは作っていない。
- アプリ同梱の使い方（`ios/Web/public/guide/index.html`）に「7. Web版から編み図を移す」を追加した。アプリはSafariの保存領域を読まないこと、Web版で書き出してから「バックアップから復元」で読み込むことを説明した。
- サポートのよくある質問（`public/support/index.html`）に「Web版で作った編み図を、iPhone・iPadアプリへ移せますか？」を追加し、手順の要約と使い方の該当節へのリンクを置いた。

## 主なファイル

- `public/guide/index.html`
- `ios/Web/public/guide/index.html`
- `public/support/index.html`
- `tests/e2e/guide-content.spec.ts`
- `scripts/guide-content.test.mjs`

## テスト

- `tests/e2e/guide-content.spec.ts`に、Web版の使い方の新しい節（見出し、書き出しの選択、ファイルへの保存、AirDrop、復元、上書きされないこと、逆方向の案内、App Storeリンク）と、サポートのよくある質問から使い方の節へ移動できることを確かめるテストを追加した。
- `scripts/guide-content.test.mjs`に、アプリ同梱の使い方がWeb版からの移し方を説明していることを確かめるテストを追加した。Web版とアプリ版で共通する段落・見出しの数は変えていない。
- `tests/e2e/seo.spec.ts`のサポートページから使い方へ戻るリンクは、新しい「使い方の…」リンクと区別するため `exact: true` にした。

## 検証

- `npm run typecheck`：成功
- `npm test`：82ファイル・1061件成功
- `npm run build`：成功
- `npm run check:dist`：成功（`dist verified: 2686.5 KiB`）
- `npm run test:e2e`：3回目で629件成功・37件スキップ。1回目と2回目は、既知の #425（`layout-focus-and-hover.spec.ts` の範囲選択を解除した後の操作メニューの位置）が1〜3件失敗した。同じファイルを単独で再実行すると成功し、3回目の全体実行も成功した。#425 は未解決のまま。
- `npx playwright test tests/e2e/guide-content.spec.ts`（chromium-desktop・chromium-mobile・webkit-mobile）：成功
- `npx playwright test tests/e2e/seo.spec.ts`（3プロジェクト）：45件成功
- `npx vitest run scripts/guide-content.test.mjs`：10件成功
- iOS Webの型検査（`tsc -p tsconfig.app.json --noEmit`）：成功
- iOS Webのテスト（`vitest run --config vite.config.ts`）：18ファイル・151件成功
- 狭い画面（390px）と広い画面（1280px）で、Web版の使い方・サポート・アプリ同梱の使い方を目視し、スクリーンショットをPRに添付した。

## デプロイ影響

Pagesへ配信される。ウェブの使い方とサポートの文言が変わる。アプリ同梱の使い方も変わるため、次回のアプリ更新に含める。iOSのFull iOS validationはPR CIとマージ後に確認する（このPRではマージしない）。
