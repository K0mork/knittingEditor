# knittingEditor

スマホを中心に設計した、ブラウザ上で動作する棒針編み図エディタです。Canvasによる仮想描画で最大1000×1000セルを扱い、データは端末のIndexedDBへ自動保存します。

## 主な機能

- 25種類の編み目記号と色指定
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

## 配布

`main`へのpush後、`.github/workflows/pages.yml`がテストとViteビルドを実行し、成功した`dist/`のみをGitHub Pagesへ公開します。公開先は[knittingeditor.com](https://knittingeditor.com/)です。

編み図はブラウザ内に保存されるため、重要なデータは「保存」メニューから定期的に`.knit`バックアップを取得してください。
