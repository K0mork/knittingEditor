# 2026-10-12 — 右増し目・左増し目・浮き目の追加

- 影響: #218。右増し目・左増し目・浮き目を共通カタログに追加。永続IDは27〜29、カタログはv4。既存IDとメタデータは維持する。増し目はJIS 2090・2100の1×1、消費1・生成2、浮き目はJIS 2170の1×2、消費1・生成1。すべて基本カテゴリ。
- 主なファイル: `packages/editor-core/stitches/catalog.ts`、`glyphs.ts`、`index.html`、`README.md`、`public/llms.txt`、Web/iOSのガイド、`ios/docs/APP_REVIEW_NOTES.md`、`APP_STORE_METADATA.md`、`SCREENSHOTS.md`、`packages/editor-core/README.md`、`ios/SPECIFICATION.md`、`ios/README.md`、`ios/DEVELOPMENT.md`、`ios/docs/WEB_SYNC.md`。既存の共通ベクトル経路で記号一覧・盤面・PNG・PDFへ反映する。
- テスト: `catalog.test.ts`の固定ID・メタデータfixture、`glyphs.test.ts`の件数を更新。新規`newStitches.test.ts`でv4メタデータ、図形、Canvas/PDF、配置範囲、バックアップ往復、既存fixtureとv3互換、将来版拒否を確認。`tests/e2e/new-stitches.spec.ts`で3記号の選択・配置・保存・再読込を追加。`database.test.ts`の出力v4、`editor.spec.ts`と`whiteout.spec.ts`の29件、`seo.spec.ts`の本文・メタデータ・構造化データを更新。
- 検証: 以下の確認が成功した。ビルド・iOS Web単体テストは初回実装時、それ以外の主要検査はNode 24.21.0で再確認した。
- Node 24.21.0で `npm run typecheck`: 成功、`npm test`: 49ファイル・487件成功。
- `npm run build`、`npm run check:dist`: 成功。
- `(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`: 成功。
- `(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`: 12ファイル・109件成功。
- `sh ios/scripts/check-app-store-docs.sh`: 成功。文書更新後も再実行して成功。
- `npm test -- scripts/`: 9ファイル・85件成功。文書更新後も再実行して成功。
- `git diff --check`: 成功。文書更新後も再実行して成功。
- `npm run test:e2e`: chromium-mobile・webkit-mobile・chromium-desktopで351件成功、6件スキップ、失敗0。`new-stitches.spec.ts`の3記号の選択・配置・保存・再読込は全プロジェクトで成功。スキップは既存のiPhone Safari専用共有シートテストのChromium分。
- Vitestでv3のID26と既存の`.knit` fixture（v2形式）の読み込み、新ID27〜29の保存・再読込、将来版v5の拒否を確認。
- WebKit 390×844とChromium 1440×900で記号一覧・盤面を目視確認し、PNG・PDFでも同じ形と向きを確認。JIS L 0201:1995の2090・2100・2170の図と一致。
- `xcodegen generate --spec ios/project.yml`後、一時的なUIテストを `xcodebuild test … -destination 'id=C6D799AB-06B5-47CE-9764-48D30A013326' -only-testing:knittingEditorUITests/D218TempUITests/testPlaceNewStitches` で実行して成功。iPhone Simulatorで3記号を選択・配置し、一覧と盤面の描画を確認。一時テストと生成物は除去済み。
- iOSの全体テスト、iPhone/iPadのアプリ更新、Release Archive・オフライン同梱物検査は未実行。局所的な選択・配置の確認とは別に、PR CIとマージ後のFull iOS validationで確認する。配信後の動作は未確認。
- デプロイ影響: マージ後にPagesとiOSの記号選択・描画が変わる。Webのメタデータ、使い方、サイト説明とApp Store文書を29種類に統一。「白くする」を含める従来の数え方を維持する。配信後はHTTPSのトップページ・ガイド・llms.txtの件数と3記号の選択・配置・PNG/PDFを確認する。現在は未配信。
- 記号の参照: [日本規格協会 JIS L 0201:1995](https://webdesk.jsa.or.jp/books/W11M0090/index/?bunsyo_id=JIS+L+0201%3A1995)、[規格本文の画像転記](https://kikakurui.com/l/L0201-1995-01.html)の4・5ページ。右増し目と左増し目は下段の目から増すJISの操作を採用し、浮き目は表側に糸を渡す横棒付きVを採用する。
