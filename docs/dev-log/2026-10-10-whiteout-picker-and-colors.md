# 2026-10-10 — 「白くする」の一覧表示と使用色集計を修正

- 影響: Web・iOS共通の記号一覧で「白くする」のSVGを記号欄に収める。白塗りセルの内部保存色を使用色の集計から除外し、通常の記号の色数と同数時の順序を保つ。Closes #190、Closes #199。
- 主なファイル: `packages/editor-core/stitches/glyphs.ts`、`packages/editor-core/model/usedColors.ts`。盤面・PNG・PDFの描画処理と保存形式は変更しない。
- テスト: `glyphs.test.ts`で全記号のSVG寸法指定を検証。`usedColors.test.ts`で白塗りだけの盤面と通常記号が混在する盤面の集計を検証。`tests/e2e/whiteout.spec.ts`で390・820・1280px幅、16・24pxの文字サイズで全タイルのSVGが記号欄内に収まることと、白塗りが盤面に置かれたうえで使用色一覧に出ないこと、通常記号の使用色一覧・色の選択を検証。
- 検証: Node 24.21.0で`npm run typecheck`、`npm test`（37ファイル・262件）、`npm run build`、`npm run check:dist`、`git diff --check`が成功。`npx playwright test tests/e2e/whiteout.spec.ts`（chromium-mobile・webkit-mobile・chromium-desktop）を2回実行し、2回とも21件成功。`npm run test:e2e`は185件成功・4件スキップ。iOS Webの`(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`と`(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`（8ファイル・34件）は共通コードの変更後に成功しており、その後の変更はE2Eテストだけ。修正前の`glyphs.ts`と`usedColors.ts`に戻すと、追加したVitest 3件と`whiteout.spec.ts`の21件がすべて失敗することを確認した（E2Eは盤面の記号数の確認を足す前の版で確認）。390px（WebKit）と1440px（Chromium）で記号一覧の「白くする」が記号欄に収まり名前・寸法に重ならないこと、使用色一覧に赤・青の白塗りの内部色が出ないこと、白塗りのセルが盤面で白く描かれることを画面で確認した。
- 未実行の検証: iPhone・iPadの記号一覧の目視確認は実施していない。iOSのXcodeGen、ビルド、iPhone・iPad Simulatorテスト、更新復元テスト、unsigned Release Archive、オフラインバンドル検査はPR CIに任せる。
- デプロイ影響: Web共通コードはPagesへ配信され、iOSは次回アプリビルドに反映される。配信後に記号一覧の白塗りタイル、使用色一覧と選択、盤面・PNG・PDFの白塗りを確認する。今回の作業ではデプロイしていない。
