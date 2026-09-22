# Web資産と共通コード

Web版とiOS版は同じリポジトリで管理する。以前の固定コミット参照と`rsync --delete`によるコピー同期は廃止し、共通コードはルートの`packages/editor-core`から両方のビルドへ解決する。

## iOS用Web bundle

`ios/scripts/build-web.sh`は、ルートの`package-lock.json`で依存関係を導入し、`ios/Web`をルートworkspaceのVite・TypeScriptでビルドする。生成物は`ios/AppResources/Web/`に置くが、生成物自体はGit管理しない。Xcodeのpre-build scriptも同じスクリプトを呼び出す。

ビルドをスキップするかどうかの入力ハッシュは、`ios/Web`、`packages`、ルートの`package.json`・`package-lock.json`、このスクリプト自身だけを対象にする。リポジトリ全体を走査すると`.git`やテスト成果物の更新でスタンプが毎回変わり、さらに走査中に消えたファイルで`shasum`が失敗してビルドフェーズごと落ちる。

## 共通コードと複製の境界

`packages/editor-core`が正本で、Web版とiOS版の同名ファイルは再エクスポートだけを持つ。対象は盤面モデル、記号カタログ・ベクター記号、IndexedDBと`.knit`入出力、PNG/PDF出力、盤面Canvasコンポーネント。永続記号IDの一覧は`packages/editor-core/README.md`にある。

次のファイルは共通化せず、両ビルドで別々に持つ。**片方だけ直した差分をここへ書き足さないまま放置しない。**

| ファイル | 差分の理由 |
|---|---|
| `App.tsx` | iOS版はネイティブブリッジ、アプリ内ダイアログ（`window.prompt`/`confirm`の代替）、モーダルのフォーカス管理、記号ピッカー、ストレージ初期化タイムアウト、使い方ページ遷移前の保存flushを持つ。Web版は`window.prompt`とSEO向けの説明表示を持つ。 |
| `analytics.ts` | Web版はGA4を初期化する。iOS版はAPI互換のno-opで、イベントも外部スクリプトも発生させない。 |
| `main.tsx` | iOS版は`initializeAnalytics()`を呼ばない。 |
| `styles.css` | iOS版はタップ領域44px、テキスト自動拡大の抑止、アプリ内ダイアログの様式を持つ。 |
| `platform.ts` | `EditorPlatform`の実装。Web版はダウンロード、iOS版は`WKWebView`ブリッジ経由でFiles・共有シートへ渡す。 |
| `storage/database.ts` | Web版だけが旧Safari `localStorage`からの移行を持ち、`initializeStorage`で実行する。iOS版は再エクスポートのみで、移行を含めない。 |
| `export/exporters.ts` | 共通実装への再エクスポートと、各プラットフォームの`saveBlob`だけ。 |
| `index.html`、`public/guide/` | Web版はSEO、canonical、CNAME、サイトマップを持つ。iOS版は同梱ページとして動作し、文言をアプリ前提にする。 |

## テストの置き場所

共通コードのテストは`packages/editor-core`に置き、ルートの`npm test`で実行する。Web固有・iOS固有の検証だけを各ビルドの`src/`へ置く。現在iOS側だけにあるのは、ネイティブブリッジ、`async`、`.knit`相互運用fixture（`ios/test-fixtures/`）、大盤面の保存・復元である。

次は共通コードを対象にしながら両ビルドに分かれて残っているテストで、統合の積み残しである。カバレッジを突き合わせてから`packages/editor-core`へまとめる。

- `model/Board.test.ts`（Web 82行 / iOS 94行）
- `export/pdf.worker.test.ts`（Web 53行 / iOS 73行）
- `stitches/glyphs.test.ts`（iOS側のみ）

## 同期ではなく同時検証

`packages/*`または保存形式を変更したPRでは、Webのtypecheck・Vitest・Vite・Playwrightに加え、iOS Web単体テスト、Swift/XCUITest、更新復元、Release Archive、オフラインbundle検査を実行する。Web版で生成した`.knit`をiOS版で読み込み、iOS側のブリッジ出力をWeb版で読み込む双方向試験を維持する。

永続記号ID 1〜26、`STITCH_CATALOG_VERSION`、IndexedDBのDB名、アプリの固定originは、既存fixtureとの互換性を確認せずに変更しない。
