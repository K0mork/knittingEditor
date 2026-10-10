# 2026-10-10 — 盤面寸法の空欄入力と目・段の単位表示を修正

- 影響: Closes #202、Closes #203。段数・列数を入力中は文字列で保持し、空欄に0を挿入しない。「変更」で数値化し、既存のBoardの検証を維持する。記号・ブロックのサイズを「目×段」で表示する。編み図一覧の「段×目」は維持する。ガイドに矛盾する寸法の記述がないことを確認した。
- 主なファイル: `packages/editor-core/ui/GridControls.tsx`、`StitchPicker.tsx`、`EditorView.tsx`。
- テスト: GridControlsのVitestで空欄から25・30への入力、確定前の盤面保持、空欄・0・小数・上限超過の拒否を検証。EditorViewのVitestで縦長記号・横長交差記号・長方形ブロックの両単位と編み図一覧の表記維持を検証。Playwrightで入力・確定・不正寸法の拒否とサイズ表示を追加。XCUITest `testSizeInputsStayEmptyUntilReplacementAndApplyOnChange`を追加。
- 検証: 型検査・ビルド・配信物検査とiOS Webテストは成功。Webテストは初回に既存の性能テスト2件が失敗し、並列数1の再実行では全件成功。Playwright（Chromium・WebKit）、画面写真、iOSビルド・Simulatorはsandboxで実行できないため未実施。検証担当とPR CIで確認する。PR CIのiOS Web、iPhone・iPadのSimulator、app-update、unsigned Release Archive、オフライン同梱物検査の全ジョブを確認する。
- デプロイ影響: マージ後、WebのPages配信とiOS同梱UIに反映される。本作業での配信はなし。配信後は空欄からの入力・変更と記号・ブロックのサイズ表示を確認する。

## 実行した確認

- 既存の作業コピー内の`node_modules`を利用したため、今回`npm ci`は再実行していません。
- Node v24.21.0で以下を実行しました。
- `npm run typecheck`: 成功。
- `npm test`: 264件成功、2件失敗。変更していない`thumbnail.test.ts`の性能上限250msに対して987.39ms、`pdf.worker.test.ts`の性能上限15000msに対して46031.13msでした。性能テストや閾値には手を加えていません。
- `npm test -- --maxWorkers=1`: 再実行で37ファイル・266件すべて成功。
- `npm run build`: 成功。
- `npm run check:dist`: 成功。
- `(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`: 成功。
- `(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`: 成功、8ファイル・34件。
- `git diff --check`: 成功。

既定Nodeはv26.8.1だったため、Node 24で次のコマンドを実行しました。最初のコマンドは`npm test`の失敗で停止し、その後の確認は2番目のコマンドで成功しました。ビルド以降の確認も別途同じNode 24で実行し、成功しました。

```sh
npm exec --cache /private/tmp/g12-npm-cache --yes --package=node@24 -- sh -c 'node --version && npm run typecheck && npm test && npm run build && npm run check:dist && (cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit) && (cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)'
npm exec --cache /private/tmp/g12-npm-cache --yes --package=node@24 -- sh -c 'npm test -- --maxWorkers=1 && npm run build && npm run check:dist && (cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit) && (cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)'
```
