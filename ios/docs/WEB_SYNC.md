# Web資産と共通コード

Web版とiOS版は同じリポジトリで管理する。以前の固定コミット参照と`rsync --delete`によるコピー同期は廃止し、共通コードはルートの`packages/editor-core`から両方のビルドへ解決する。

## iOS用Web bundle

`ios/scripts/build-web.sh`は、ルートの`package-lock.json`で依存関係を導入し、`ios/Web`をルートworkspaceのVite・TypeScriptでビルドする。生成物は`ios/AppResources/Web/`に置くが、生成物自体はGit管理しない。Xcodeのpre-build scriptも同じスクリプトを呼び出す。

ビルドをスキップするかどうかの入力ハッシュは、`ios/Web`、`packages`、ルートの`package.json`・`package-lock.json`・`tsconfig.base.json`・`vite.shared.ts`、このスクリプト自身だけを対象にする。リポジトリ全体を走査すると`.git`やテスト成果物の更新でスタンプが毎回変わり、さらに走査中に消えたファイルで`shasum`が失敗してビルドフェーズごと落ちる。テスト（`*.test.ts`・`*.test.tsx`）とMarkdownはbundleに入らないので、ハッシュ対象から外す。共通のビルド設定を新しいファイルへ切り出すときは、このハッシュ対象とCIの変更判定（`.github/workflows/ci.yml`の`changes`ジョブ）の両方へ必ず追加する。

## 共通コードと複製の境界

`packages/editor-core`が正本で、Web版とiOS版の同名ファイルは再エクスポートだけを持つ。対象は盤面モデル、記号カタログ・ベクター記号、IndexedDBと`.knit`入出力、PNG/PDF出力とそのレイアウト計算、盤面Canvasコンポーネント、編集セッション（`state/useEditorSession.ts`）、共通UI部品（`ui/`）、共通CSS（`styles/base.css`）。永続記号IDの一覧は`packages/editor-core/README.md`にある。

共通化した主なものは次のとおり。

| 共通ファイル | 内容 |
|---|---|
| `state/useEditorSession.ts` | 編み図の読み込み、自動保存、即時保存、編み図切り替え、`beforeunload`確認。保存経路はここ1本にまとめ、自動保存も即時保存も同じ世代番号の確認を通す。保存後は結果の1件だけを一覧へ反映し、全件を読み直さない。書き切れていないときは盤面を差し替えず、`switchDocument`が中止理由（`switched`／`pending`／`failed`）を返す。`failed`は`onSaveError`が通知するので、呼び出し側は`pending`のときだけ自前で通知する。 |
| `ui/StitchPicker.tsx` | 記号ピッカー。フォーカストラップとEscapeでの閉じ方を含む。 |
| `ui/GridControls.tsx` | 盤面設定。位置入力と確認は`askText`・`askConfirm`で受け取る。 |
| `ui/ExportControls.tsx` | 保存・出力。PDFの推定ページ数は`export/pdfLayout.ts`をPDF Workerと共有する。 |
| `ui/hooks.ts` | モーダルのフォーカス管理、ドロワーのフォーカス復帰、トースト、コピー／貼り付けのショートカット。 |
| `styles/base.css` | 共通の見た目。環境で変える寸法はカスタムプロパティ（`--tap-size`など）で受け取る。 |

共通CSSは各ビルドの`main.tsx`が`styles.css`より先に読み込む。**環境固有のCSSは共通CSSのメディアクエリより後ろに置かれる。**画面幅で切り替えている宣言（`.workspace`・`.action-bar`・`.drawer`のレイアウト）を環境側で上書きすると、メディアクエリの指定を打ち消すので、そうした値は共通CSS側へ入れるかカスタムプロパティにする。

次のファイルは共通化せず、両ビルドで別々に持つ。**片方だけ直した差分をここへ書き足さないまま放置しない。**

| ファイル | 差分の理由 |
|---|---|
| `App.tsx` | iOS版はネイティブブリッジ、アプリ内ダイアログ（`window.prompt`/`confirm`の代替）、ストレージ初期化タイムアウト、使い方ページ遷移前の保存flushを持つ。Web版は`window.prompt`とSEO向けの説明表示を持つ。状態管理・記号ピッカー・盤面設定・出力設定は共通部品を呼ぶだけにする。 |
| `analytics.ts` | Web版はGA4を初期化する。iOS版はAPI互換のno-opで、イベントも外部スクリプトも発生させない。 |
| `main.tsx` | iOS版は`initializeAnalytics()`を呼ばない。 |
| `styles.css` | 共通CSSへの差分だけ。iOS版はタップ領域44px、Dynamic Type、テキスト自動拡大の抑止、アプリ内ダイアログの様式。Web版はSEO向けの説明文と編み図名の表示。 |
| `platform.ts` | `EditorPlatform`の実装。Web版はダウンロード、iOS版は`WKWebView`ブリッジ経由でFiles・共有シートへ渡す。 |
| `storage/database.ts` | Web版だけが旧Safari `localStorage`からの移行を持ち、`initializeStorage`で実行する。iOS版は再エクスポートのみで、移行を含めない。 |
| `export/exporters.ts` | 共通実装への再エクスポートと、各プラットフォームの`saveBlob`だけ。 |
| `index.html`、`public/guide/` | Web版はSEO、canonical、CNAME、サイトマップを持つ。iOS版は同梱ページとして動作し、文言をアプリ前提にする。 |

## テストの置き場所

共通コードのテストは`packages/editor-core`に置き、ルートの`npm test`で実行する。Web固有・iOS固有の検証だけを各ビルドの`src/`へ置く。

現在の内訳は次のとおりで、共通テストの二重管理は解消済みである。

- `packages/editor-core`：盤面モデル、記号カタログ、ベクター記号、Canvas、PNG/PDF出力、PDFレイアウト計算、IndexedDBと`.knit`入出力（大盤面の保存・復元を含む）、編集セッション。
- `src/`（Web固有）：旧Safari `localStorage`からの移行、GA4アナリティクス。
- `ios/Web/src/`（iOS固有）：ネイティブブリッジ、`async`のタイムアウト、ブリッジ経由の`.knit`入出力、`.knit`相互運用fixture（`ios/test-fixtures/`）。

共通コードのテストを`.tsx`で書く場合も、両ビルドのVitest設定が`*.test.tsx`を拾う。

## 同期ではなく同時検証

`packages/*`または保存形式を変更したPRでは、Webのtypecheck・Vitest・Vite・Playwrightに加え、iOS Web単体テスト、Swift/XCUITest、更新復元、Release Archive、オフラインbundle検査を実行する。Web版で生成した`.knit`をiOS版で読み込み、iOS側のブリッジ出力をWeb版で読み込む双方向試験を維持する。

永続記号ID 1〜26、`STITCH_CATALOG_VERSION`、IndexedDBのDB名、アプリの固定originは、既存fixtureとの互換性を確認せずに変更しない。
