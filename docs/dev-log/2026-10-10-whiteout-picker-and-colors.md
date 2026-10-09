# 2026-10-10 — 「白くする」の一覧表示と使用色集計を修正

- 影響: Web・iOS共通の記号一覧で「白くする」のSVGを記号欄に収める。白塗りセルの内部保存色を使用色の集計から除外し、通常の記号の色数と同数時の順序を保つ。Closes #190、Closes #199。
- 主なファイル: `packages/editor-core/stitches/glyphs.ts`、`packages/editor-core/model/usedColors.ts`。盤面・PNG・PDFの描画処理と保存形式は変更しない。
- テスト: `glyphs.test.ts`で全記号のSVG寸法指定を検証。`usedColors.test.ts`で白塗りだけの盤面と通常記号が混在する盤面の集計を検証。`tests/e2e/whiteout.spec.ts`で390・820・1280px幅、16・24pxの文字サイズで全タイルのSVGが記号欄内に収まることと、使用色一覧・色の選択を検証。
- 検証: `npm ci`成功。Node 24.21.0で`npm run typecheck`、`npm test`（37ファイル・262件）、`npm run build`、`npm run check:dist`、`(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`、`(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`（8ファイル・34件）が成功。`git diff --check`成功。`npx playwright test tests/e2e/whiteout.spec.ts --list`で21ケースを認識（実行成功を意味しない）。初回のNode 26.8.1での`npm test`は既存の大規模PDF性能テストが30.35秒となり15秒の上限を超えて失敗したが、指定のNode 24で全件成功した。
- 未実行の検証: サンドボックスでブラウザーとSimulatorを起動できないため、`npm run test:e2e`（Chromium・WebKit）と画面写真は検証担当に依頼。iPhone・iPadの記号一覧を通常・拡大文字で確認する。iOSのXcodeGen、ビルド、iPhone・iPad Simulatorテスト、更新復元テスト、unsigned Release Archive、オフラインバンドル検査はPR CIに任せる。
- デプロイ影響: Web共通コードはPagesへ配信され、iOSは次回アプリビルドに反映される。配信後に記号一覧の白塗りタイル、使用色一覧と選択、盤面・PNG・PDFの白塗りを確認する。今回の作業ではデプロイしていない。
