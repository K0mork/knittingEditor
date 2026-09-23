# Editor core

Web版（ルートの`src/`）とiOS版（`ios/Web/src/`）が共有する実装を置く。両方のビルドは
ここを直接importし、実装を複製しない。

## 収録範囲

| 範囲 | 内容 |
|---|---|
| `model/` | packed盤面、色、記号の配置。ReactにもDOMにも依存しない。 |
| `stitches/` | 記号カタログとベクター記号。`catalog.ts`と`glyphs.ts`は一体で扱う。 |
| `storage/` | IndexedDBと`.knit`バックアップの入出力・検証。 |
| `export/` | PNG描画、PDF Worker、PDFの用紙分割計算。Canvas APIを使う。 |
| `canvas/` | 盤面のCanvasコンポーネント。Reactを使う。 |
| `state/` | 編集セッション。読み込み・自動保存・即時保存・編み図切り替えを1本にまとめる。 |
| `ui/` | 編集画面（`useEditorController.ts`が状態と操作、`EditorView.tsx`が画面）、記号ピッカー、盤面設定、出力設定と、それらが使う共通フック。 |
| `util/` | エラー文言への変換、base64変換などの小さな共通処理。 |
| `analytics.ts` | 分析イベントの受け口の型と、盤面寸法・件数のバケット。送信の実装は置かない。 |
| `styles/` | 共通CSS。環境で変える寸法はカスタムプロパティで受け取る。 |
| `platform.ts` | WebとiOSで実装が分かれるhost機能の型。 |

`model/`はReactとDOMから独立させる。`export/`と`canvas/`はブラウザAPIを使うが、
Web固有・iOS固有の分岐は持たない。分岐が要るものは`platform.ts`へ足すのではなく、
まず各ビルド側に置けないかを検討する。`platform.ts`には、両方で実際に呼ばれる操作だけを置く。

`ui/`の部品は環境固有の処理をpropsで受け取る。`window.prompt`とアプリ内ダイアログの違いは
`askText`・`askConfirm`、ファイルの受け渡しは`platform`、分析は`analytics`、見出し・フッター・
案内文の違いは`EditorView`の`renderTitle`・`footer`・`backupNote`で渡し、部品の中で分岐させない。
PDFの推定ページ数は`export/pdfLayout.ts`をPDF Workerと共有し、用紙寸法をUI側へ書き写さない。

ここへ置かないもの: SEO、分析、旧Safari移行、`WKWebView`ブリッジ、Files・共有シート、
そして`App.tsx`と`styles.css`（両ビルドで内容が異なる。`App.tsx`は共通の編集画面へ差分を渡すだけにする）。差分の一覧は
`ios/docs/WEB_SYNC.md`にある。

## 永続記号IDスナップショット

`.knit`とIndexedDBに保存される永続値。カタログの配列順ではなくこのIDが正で、
変更・再利用・配列位置からの再採番をしない。`STITCH_CATALOG_VERSION`は現在3。

| ID | key | ID | key |
|---:|---|---:|---|
| 1 | `knit` | 14 | `purl_left_cross_twist_stitch` |
| 2 | `purl` | 15 | `middle_up_three_one` |
| 3 | `yo` | 16 | `right_up_three_one` |
| 4 | `right_up_two_one` | 17 | `left_up_three_one` |
| 5 | `left_up_two_one` | 18 | `right_up_two_cross` |
| 6 | `purl_left_up_two_one` | 19 | `left_up_two_cross` |
| 7 | `right_cross` | 20 | `right_up_three_cross` |
| 8 | `left_cross` | 21 | `left_up_three_cross` |
| 9 | `purl_right_cross` | 22 | `slip_stitch` |
| 10 | `purl_left_cross` | 23 | `twist_stitch` |
| 11 | `purl_right_up_two_cross` | 24 | `purl_twist_stitch` |
| 12 | `purl_left_up_two_cross` | 25 | `erase` |
| 13 | `purl_right_cross_twist_stitch` | 26 | `purl_right_up_two_one` |

IndexedDBのDB名`knitting-editor-v2`、`.knit`の`format`・`version`・`stitchCatalogVersion`も
同じ扱いとし、既存fixtureとの互換性を確認せずに変更しない。

## テスト

共通コードのテストはこのパッケージ内に置き、ルートの`npm test`で実行する
（`vite.config.ts`の`test.include`が`packages/**/*.test.{ts,tsx}`を拾う）。
Web固有・iOS固有の検証だけを各ビルドの`src/`へ置く。
