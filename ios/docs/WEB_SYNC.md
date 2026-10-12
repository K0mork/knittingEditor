# Web資産と共通コード

Web版とiOS版は同じリポジトリで管理する。以前の固定コミット参照と`rsync --delete`によるコピー同期は廃止し、共通コードはルートの`packages/editor-core`から両方のビルドへ解決する。

## iOS用Web bundle

`ios/scripts/build-web.sh`は、ルートの`package-lock.json`で依存関係を導入し、`ios/Web`をルートworkspaceのVite・TypeScriptでビルドする。生成物は`ios/AppResources/Web/`に置くが、生成物自体はGit管理しない。Xcodeのpre-build scriptも同じスクリプトを呼び出す。

ビルドをスキップするかどうかの入力ハッシュは、`ios/Web`、`packages`、ルートの`package.json`・`package-lock.json`・`tsconfig.base.json`・`vite.shared.ts`・`scripts/third-party-notices.mjs`、このスクリプト自身だけを対象にする。リポジトリ全体を走査すると`.git`やテスト成果物の更新でスタンプが毎回変わり、さらに走査中に消えたファイルで`shasum`が失敗してビルドフェーズごと落ちる。テスト（`*.test.ts`・`*.test.tsx`）とMarkdownはbundleに入らないので、ハッシュ対象から外す。共通のビルド設定を新しいファイルへ切り出すときは、このハッシュ対象とCIの変更判定（`.github/workflows/ci.yml`の`changes`ジョブ）の両方へ必ず追加する。

## 共通コードと複製の境界

`packages/editor-core`が正本で、Web版とiOS版は共通コードを直接importする。再エクスポートだけのファイルは置かない。対象は盤面モデル、記号カタログ・ベクター記号、IndexedDBと`.knit`入出力、PNG/PDF出力とそのレイアウト計算、盤面Canvasコンポーネント、編集セッション（`state/useEditorSession.ts`）、編集画面（`ui/useEditorController.ts`・`ui/EditorView.tsx`）、共通UI部品（`ui/`）、共通CSS（`styles/base.css`）。永続記号IDの一覧は`packages/editor-core/README.md`にある。

共通化した主なものは次のとおり。

| 共通ファイル | 内容 |
|---|---|
| `state/useEditorSession.ts` | 編み図の読み込み、自動保存、即時保存、編み図切り替え、`beforeunload`確認。保存経路はここ1本にまとめ、自動保存も即時保存も同じ世代番号の確認を通す。保存後は結果の1件だけを一覧へ反映し、全件を読み直さない。書き切れていないときは盤面を差し替えず、`switchDocument`が中止理由（`switched`／`pending`／`failed`）を返す。`failed`は`onSaveError`が通知するので、呼び出し側は`pending`のときだけ自前で通知する。 |
| `ui/useEditorController.ts` | 編集画面の状態と操作。記号・色・モード・選択範囲・貼り付け・パネル、編み図とブロックの操作、PNG/PDF出力、バックアップと復元。入力ダイアログ（`askText`・`askConfirm`）、ファイルの受け渡し（`platform`）、分析（`analytics`、省略時は送らない）を引数で受け取る。保存失敗の文言は`saveErrorMessage`にまとめる。 |
| `ui/EditorView.tsx` | 編集画面の組み立て。見出し（`renderTitle`）、使い方リンクの処理（`onGuideClick`）、復元要求の横取り（`requestRestore`）、案内文（`backupNote`）、「編み図」パネルの一覧の後ろの案内（`documentsNote`、省略時は出さない）、フッター、重ねる要素（`children`）だけを各ビルドから受け取る。 |
| `ui/StitchPicker.tsx` | 記号ピッカー。フォーカストラップとEscapeでの閉じ方を含む。 |
| `ui/ColorPicker.tsx` | 記号の色の選択。編み図で使っている色の一覧（`model/usedColors.ts`）と、一覧にない色を選ぶ色選択を出す。 |
| `ui/GridControls.tsx` | 盤面設定。位置入力と確認は`askText`・`askConfirm`で受け取る。盤面の地の色（背景色）も選ぶ。白・グレー・黒のボタンと色選択で、色は編み図ごとに記録（`ChartDocument.backgroundColor`）と`.knit`へ入る。縞と罫線の色は地の色から作る（`model/boardColors.ts`）。 |
| `ui/DocumentList.tsx` | 編み図パネルの一覧。縮小画像（`model/thumbnail.ts`）、寸法、更新日時（`ui/documentListText.ts`）と、名前変更・複製・削除のボタン。縮小画像は保存せず、保存済みのセル配列と地の色から作る。 |
| `ui/ExportControls.tsx` | 保存・出力。PDFの推定ページ数は`export/pdfLayout.ts`をPDF Workerと共有する。 |
| `state/backupReminder.ts`・`state/useBackupReminder.ts`・`ui/BackupReminderBar.tsx` | 最後の`.knit`書き出し日時の記録と、書き出しを勧める帯。日時は編み図ごとに設定（`lastBackupAt:<編み図ID>`）へ置き、編み図の記録と`.knit`には入れない。勧めは、最後の書き出し（無ければ作成）から7日以上たって変更があるとき、または開いてから50回編集したときに、道具列と盤面の間へ1段だけ出す。「あとで」で3日間（全編み図）出さない。Web版もブラウザのデータ消去やSafariの保存期限で端末内データが消えうるので、iOS版と同じ表示を出し、差分は設けない。帯は指・ポインタを画面に置いている間は出さない。日時は`EditorPlatform.saveFile`の`saved`が`false`（取りやめた）なら記録しない。Web版はiPhone・iPadのSafariの確認ダイアログと共有シートの結果を返し、ダウンロードは`undefined`（不明）を返す。iOS版はネイティブの保存画面・共有シート・確認アラートの結果を`knittingEditorNativeExportFinished`で受け取って返し（#122、`ios/docs/NATIVE_BRIDGE.md`）、保存・共有を終えた日時だけを記録する。 |
| `ui/hooks.ts` | モーダルのフォーカス管理、ドロワーのフォーカス復帰、トースト、コピー／貼り付けのショートカット。 |
| `styles/base.css` | 共通の見た目。環境で変える寸法はカスタムプロパティ（`--tap-size`など）で受け取る。色もカスタムプロパティにまとめ、`@media (prefers-color-scheme: dark)`でダーク用の値に差し替える（#116）。切り替えは端末の外観に従うだけで、アプリ内の設定は無い。盤面のマスは編み図の背景色で描き、外観では変えない。盤面の外側と段・目番号の帯の色は`--canvas-*`で、`BoardCanvas`が読み、外観が変わると描き直す。地の色（`:root`の`background`）を変えるときは、iOS版の`AppColors.editorPageBackground`（ライト・ダーク）もそろえる（`AppAppearanceTests`が同梱のCSSと比べる）。 |

共通CSSは各ビルドの`main.tsx`が`styles.css`より先に読み込む。**環境固有のCSSは共通CSSのメディアクエリより後ろに置かれる。**画面幅で切り替えている宣言（`.workspace`・`.action-bar`・`.drawer`のレイアウト）を環境側で上書きすると、メディアクエリの指定を打ち消すので、そうした値は共通CSS側へ入れるかカスタムプロパティにする。

次のファイルは共通化せず、両ビルドで別々に持つ。**片方だけ直した差分をここへ書き足さないまま放置しない。**

| ファイル | 差分の理由 |
|---|---|
| `App.tsx` | `useEditorController`と`EditorView`へ差分を渡すだけにする。iOS版はネイティブブリッジ、アプリ内ダイアログ（`AppDialog.tsx`、`window.prompt`/`confirm`の代替）、ストレージ初期化タイムアウト、使い方ページ遷移前・バックグラウンド移行前の保存flushを持つ。Web版は`window.prompt`、旧データ移行つきの初期化、GA4、SEO向けの説明表示を持ち、`documentsNote`でプライバシーポリシー（`/privacy/`）へのリンクを渡す。iOS版はアクセス解析を送らないので`documentsNote`を渡さず、何も表示しない。 |
| `analytics.ts` | Web版だけが持ち、GA4を初期化して`EditorAnalytics`を実装する。iOS版にはファイル自体が無く、分析を渡さないのでイベントも外部スクリプトも発生させない。 |
| `main.tsx` | iOS版は`initializeAnalytics()`を呼ばない。 |
| `styles.css` | 共通CSSへの差分だけ。iOS版はタップ領域44px、Dynamic Type、テキスト自動拡大の抑止、長押しの文字選択とメニュー（コピー・調べる）の抑止、アプリ内ダイアログの様式。文字選択は入力欄（`input`・`textarea`と、`contenteditable="false"`でない`[contenteditable]`）だけ元に戻し、編み図名などを選択・コピー・貼り付けできるようにする。Web版はSEO向けの説明文と編み図名の表示で、文字選択は抑えない（ブラウザでは説明文や見出しを選んでコピーできるのが普通で、長押しのメニューもWebページとして自然なため）。 |
| `platform.ts` | `EditorPlatform`の実装。Web版はダウンロード、iOS版は`WKWebView`ブリッジ経由でFiles・共有シートへ渡す。Web版でもiPhone・iPadのSafariだけは、`<a download>`のPDFが編集中のタブを置き換えるため、`ShareFileDialog.tsx`の「共有・保存」ボタンから共有シート（Web Share API）で渡す。共有シートは利用者のタップの中でしか開けないので、生成後にもう一度押してもらう。 |
| `storage/database.ts` | Web版だけが持ち、旧Safari `localStorage`からの移行と、それを先に行う`initializeStorage`を置く。iOS版にはファイル自体が無く、共通の`initializeStorage`を直接使うので移行を含めない。 |
| `index.html`、`public/guide/` | Web版はSEO、canonical、CNAME、サイトマップを持つ。サポート（`public/support/`）とプライバシーポリシー（`public/privacy/`）はWeb版だけに置く。プライバシーポリシーはWeb版のGA4の送信を公表するページで、アクセス解析を送らないiOS版には同梱しない（アプリのポリシーは`ios/docs/PRIVACY_POLICY.md`）。iOS版は同梱ページとして動作し、文言をアプリ前提にする。iOS版の使い方ページは、アプリから受け取ったバージョンとビルド番号を末尾に表示する（`NATIVE_BRIDGE.md`の「アプリ情報」）。どちらの使い方ページも、ビルド時に生成する`/third-party-notices/`（`scripts/third-party-notices.mjs`）へリンクする。iOS版の編集画面はviewportを`maximum-scale=1, user-scalable=no`にし、盤面の外のピンチやダブルタップで画面全体を拡大しない（文字の拡大はDynamic Typeと端末の「ズーム」で行う）。Web版は`maximum-scale=5`のままで、ブラウザの拡大を残す。iOS版の使い方ページは読み物でDynamic Typeに追従しないので、拡大と文字選択を残す。リンクの長押しプレビューは`WKWebView.allowsLinkPreview = false`で両ページとも出さない。 |
| `vite.config.ts` | iOS版は`modulePreload`を切り、ソースマップを同梱しない。Web版は本番ビルドの出力するすべてのHTMLへContent-Security-Policyのmetaを入れる（`scripts/content-security-policy.mjs`、`npm run check:dist`が検査）。開発サーバーには入れない。iOS版には入れない（#135で判断）。iOS版はアプリに同梱したファイルだけを`knitting-local:`スキームで配信し、外部のスクリプトやアクセス解析を読み込まず、外部への送信もしない（`LocalWebSchemeHandlerTests`が実行時の通信APIの呼び出しを検出する）。CSPで絞れる読み込み元と送信先が元々ないため入れない。外部への通信や外部の資産を読み込む処理を加えるときは、あわせて見直す。 |

## テストの置き場所

共通コードのテストは`packages/editor-core`に置き、ルートの`npm test`で実行する。Web固有・iOS固有の検証だけを各ビルドの`src/`へ置く。

現在の内訳は次のとおりで、共通テストの二重管理は解消済みである。

- `packages/editor-core`：盤面モデル、記号カタログ、ベクター記号、Canvas、PNG/PDF出力、PDFレイアウト計算、IndexedDBと`.knit`入出力（大盤面の保存・復元を含む）、編集セッション、編集画面、最後のバックアップ日時と書き出しの勧め（既存データの読み出しを含む）、base64変換、分析バケット。
- `src/`（Web固有）：旧Safari `localStorage`からの移行、GA4アナリティクス、iPhone・iPad Safariの共有シート判定と確認ダイアログ。
- `ios/Web/src/`（iOS固有）：ネイティブブリッジ、`webReady`を編集画面が画面に出てから送ること（`editorReady.test.ts`）、`async`のタイムアウト、使い方ページのバージョン表示（`guideVersion.test.ts`）、ブリッジ経由の`.knit`入出力と`.knit`相互運用fixture（`backupInterchange.test.ts`、`ios/test-fixtures/`）。

両ビルドのVitest設定は`*.test.tsx`に対応するが、対象ディレクトリは異なる。ルートの`npm test`は`packages/`の共通テストを実行する（CIでは`web`ジョブ）。iOS単独のVitestは`ios/Web/src/`の固有テストだけを実行し、共通テストは実行しない。

## 同期ではなく同時検証

`packages/*`または保存形式を変更したPRでは、Webのtypecheck・Vitest・Vite・Playwrightに加え、iOS Web単体テスト、Swift/XCUITest、更新復元、Release Archive、オフラインbundle検査を実行する。Web版で生成した`.knit`をiOS版で読み込み、iOS側のブリッジ出力をWeb版で読み込む双方向試験を維持する。

永続記号ID 1〜26、`STITCH_CATALOG_VERSION`、IndexedDBのDB名、アプリの固定originは、既存fixtureとの互換性を確認せずに変更しない。
