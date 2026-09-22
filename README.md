# knittingEditor

スマホを中心に設計した、ブラウザとiPhone・iPadで動作する棒針編み図エディタです。Canvasによる仮想描画で最大1000×1000セルを扱い、データは端末のIndexedDBへ自動保存します。

Web版とiOS版はこのリポジトリで管理します。盤面、記号、`.knit`形式、PNG/PDF生成の共通実装は `packages/editor-core` にあり、Web版はルート、iOS版は `ios/` に配置しています。iOSのXcodeビルドはルートworkspaceから `ios/Web` を生成し、生成物をアプリへ同梱します。

## 主な機能

- 26種類の編み目記号と色指定
- 1本指・マウスドラッグによる連続入力
- 2本指パン・ピンチズーム、PCのホイール操作
- 行・列の追加、挿入、削除、盤面サイズ変更
- 複数の名前付き編み図を端末内で管理
- 矩形パターンをブロックとして保存・貼付
- PNG、1ページPDF、A4分割PDFへの出力
- `.knit`バックアップの書出し・復元
- 旧版`localStorage`データの自動移行

## 開発

Node.js 24以上を使用します。

```sh
npm ci
npm run dev
```

品質確認は次のコマンドで実行します。

```sh
npm run typecheck
npm test
npm run build
npm run check:dist
npx playwright install chromium webkit
npm run test:e2e
```

iOS側のWeb bundleを確認する場合は、ルートで依存関係を導入した後に実行します。

```sh
cd ios
./scripts/build-web.sh
cd Web
../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit
../../node_modules/.bin/vitest run --config vite.config.ts
```

## 配布

`main`へのpush後、`.github/workflows/ci.yml`が変更範囲に応じたWeb・iOS検証を実行します。Webまたは共通コードに影響する変更では、Web検証とiOS検証の成功後に、生成した`dist/`だけをGitHub Pagesへ公開します。iOS専用変更ではPagesを再公開しません。公開先は[knittingeditor.com](https://knittingeditor.com/)です。

編み図はブラウザ内に保存されるため、重要なデータは「保存」メニューから定期的に`.knit`バックアップを取得してください。
