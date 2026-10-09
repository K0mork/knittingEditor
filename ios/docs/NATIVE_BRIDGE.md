# Native bridge specification

M3では、編集機能をWeb資産に残し、ファイル操作だけをiOSネイティブへ委譲する。WebViewがない通常のブラウザでは、既存の`<a download>`と`<input type=file>`へフォールバックする。

## Web → Swift

`window.webkit.messageHandlers.knittingEditor.postMessage()`へ次のJSONオブジェクトを送る。

```json
{
  "version": 1,
  "type": "exportFile",
  "id": "export-mg0x1a2b-k3j9f0a1-1",
  "filename": "chart.png",
  "mimeType": "image/png",
  "dataBase64": "..."
}
```

バックアップの読み込み要求は`{"version":1,"type":"openBackup"}`。Swift側は`UIDocumentPickerViewController`で`.knit`を選択し、読み取ったデータをWebViewへ返す。

編集画面を表示できたら、`{"version":1,"type":"webReady"}`を送る。表示できたとは、端末内データを読み込んで編集画面と盤面を描き、それが画面に出たこと（`requestAnimationFrame`を2回待つ、`ios/Web/src/editorReady.ts`）を指す。読み込みに失敗したときは、失敗の理由を出してから送る。バックアップイベントの購読はReactの最初の描画で済ませるので、`webReady`の時点では必ず購読が終わっている。Swift側はこの通知前に受け取ったOpen URLのバックアップを保持し、通知後に一度だけWebViewへ配送する。これにより、起動直後やアプリ更新直後のイベント取りこぼしを防ぐ。

Swift側は`webReady`を受けると、準備中の表示（「編み図を準備しています…」）を0.2秒で薄くして消す（「視差効果を減らす」がオンのときはすぐ消す）。以前は端末内データの読み込みより前に`webReady`を送っていたため、準備中の表示が消えてから編集画面が出るまでに、Web側の「編み図を読み込んでいます…」が一瞬見えていた（#117）。

Swiftはファイル種別、ファイル名、Base64、128 MiBの上限を検証し、失敗時は`knittingEditorNativeError`イベントを発生させる。出力は一時ファイルを介して「ファイルに保存」または共有シートへ渡す。

`id`は書き出しの結果を返す先の要求ID（#122）で、英数字・`-`・`_`の1〜64文字に限る。`id`が無い`exportFile`も受け付け（`version: 1`のまま後方互換）、結果を返さない。形の合わない`id`は`knittingEditorNativeError`で拒否する。結果は「書き出しの結果（Swift → Web）」の節を参照。

`UIDocumentPickerViewController`は取り込みと書き出しのどちらでも`documentPicker(_:didPickDocumentsAt:)`を呼ぶため、Coordinatorは提示時の用途を保持し、書き出し完了のURLを取り込みとして扱わない。書き出しの一時ファイルは完了・キャンセルのどちらでも削除する。

## メニューバーとキーボードショートカット

iPadのメニューバーと、⌘キーの長押しで出るショートカットの一覧へ、編集画面の操作を載せる（#80）。項目はSwiftUIの`.commands`（`App/EditorCommands.swift`の`EditorCommands`）で定義し、選ばれたらSwiftは次のCustomEventをWebViewへ送るだけにする。操作の中身は画面のボタンと同じWeb側の処理で、Swiftに複製しない。

```js
window.dispatchEvent(new CustomEvent('knittingEditorNativeCommand', { detail: 'undo' }));
```

| メニュー | 項目 | キー | `detail` | Web側の処理 |
|---|---|---|---|---|
| ファイル | 新しい編み図… | ⌘N | `newDocument` | 「編み図」パネルの「新しい編み図」 |
| ファイル | 開く…（iPadOSが足す項目） | ⌘O | `restoreBackup` | 「復元」。`openBackup`でDocument Pickerを開く |
| ファイル | この編み図をバックアップ… | ⌘S | `exportBackup` | 「この編み図」の`.knit`書き出し |
| ファイル | 全データをバックアップ… | ⌥⌘S | `exportAllBackup` | 「全データ」の`.knit`書き出し |
| ファイル | PNGで書き出す… | ⇧⌘E | `exportPng` | 「PNGを保存」。画素数は保存・出力パネルを初めて開いたときの既定値 |
| ファイル | PDFで書き出す… | ⌘P | `exportPdf` | 「PDFを保存」。全体を1ページ・A4縦（パネルの既定値） |
| 編集 | 元に戻す | ⌘Z | `undo` | 操作メニューの「元に戻す」 |
| 編集 | やり直す | ⇧⌘Z | `redo` | 操作メニューの「やり直す」 |
| ヘルプ | 棒針編み図の使い方 | ⇧⌘H | `openGuide` | 「使い方」。保留中の保存を書き込んでから移る |

⌘Oの「開く…」はアプリの項目ではない。`LSSupportsOpeningDocumentsInPlace`を有効にすると（「`.knit`登録」の節）、iPadOSが「ファイル」メニューの先頭に「開く…」（⌘O、`open:`）と「最近使った項目を開く」を足し、外すことも名前を変えることもできない。`EditorCommands`に同じ⌘Oの項目を置くと、その項目を含むグループがまるごとメニューから外れ、⌘Nの「新しい編み図…」も効かなくなった（iOS 26.5のSimulator、#149）。そこで復元の項目は置かず、`AppDelegate`（`UIApplicationDelegateAdaptor`）が`open:`を受けて`restoreBackup`を送る。選べるかどうかは他の項目と同じ`canPerform`に従う。

Web側は`ios/Web/src/nativeBridge.ts`の`listenNativeCommand`で受け、`NATIVE_COMMANDS`に無い値は捨てる。`nativeCommands.ts`の`runNativeCommand`は次のように扱う。

- 元に戻す・やり直すは、Web版のキー操作（`useHistoryShortcuts`）と同じ扱いにする。入力欄（`packages/editor-core/ui/hooks.ts`の`isEditableTarget`。Web版と同じ判定を共有する）にフォーカスがある間は、盤面ではなく入力中の文字に効かせる（`document.execCommand('undo')`・`('redo')`）。それ以外では、出力や復元の処理中や、アプリ内ダイアログ・記号の一覧を開いている間も盤面に効かせる。
- ほかの操作は、出力や復元の処理中（`busy`）と、アプリ内ダイアログや記号の一覧（`aria-modal="true"`）を開いている間は始めない。

標準の「取り消す」「やり直す」（UIKitの`undo:`・`redo:`）はWeb側の編集履歴に届かないため、`CommandGroup(replacing: .undoRedo)`で置き換える。選べる状態のメニュー項目にショートカットが合うと、UIKitがキーを受け取り、WebViewの`keydown`へは届かない。このため⌘Z・⇧⌘ZはWeb側のキー操作（`useHistoryShortcuts`）と二重には実行されない（`KeyboardCommandUITests`で、1回の⌘Zで1件だけ戻ることを確かめている）。項目を選べないとき（戻せる編集が無いときなど）は、キーはWebViewの`keydown`へ届く。

置き換えたことで、入力欄の文字の取り消しに使われていた標準のキー割り当ても無くなる。項目を選べないときに入力欄で⌘Zを押すと、キーは`keydown`へ届くが、`useHistoryShortcuts`は入力欄では何もしないため、文字が戻らない。そこでWebは入力欄にフォーカスがある間、`commandState`の`canUndo`・`canRedo`を盤面の履歴にかかわらず`true`にして送る（`nativeHistoryState`・`watchTextEditing`）。入力欄での⌘Z・⇧⌘Zは常にメニューを通り、`runNativeCommand`から`execCommand`で入力中の文字を取り消す・やり直す。WKWebViewで効くことは、新しい編み図のダイアログで文字を打ち、盤面に戻せる編集が無いときとあるときの両方で`KeyboardCommandUITests`が確かめている。

ページに`keydown`が届かないと、Web側は物理キーボードがあることに気付けず、記号の一覧の「Escapeで閉じます。」などの案内を出さない。Web側はネイティブの操作を受けたら`noteHardwareKeyboard()`（`packages/editor-core/ui/inputEnvironment.ts`）でキーボードがあるとみなす。メニューバーを指で開いて選んだときも同じ扱いになるが、案内が1文増えるだけである。

使い方のキーは、慣習の⌘?（⇧⌘/）にするとメニューには載るものの、iPadのSimulatorで押しても項目が呼ばれなかったため、⇧⌘H（Help）にした。

メニューの項目は、編集画面が`webReady`を送ってから、使い方ページなどへ移るまでの間だけ選べる。元に戻す・やり直すは、Webが編集履歴の状態を次のメッセージで知らせ、画面のボタンと同じ条件で選べるようにする。

```json
{ "version": 1, "type": "commandState", "canUndo": true, "canRedo": false }
```

Swiftは保存画面・共有シート・Document Pickerを表示している間（`WebViewModel.isPresentingNativeUI`）、メニューの項目をすべて選べない表示にし、操作を送らない。新しい操作のたびにWeb側で別の出力やダイアログが重なるのを防ぐためである。表示した時点で立て、キャンセル・保存の完了・共有シートの完了・下へスワイプして閉じたとき（`presentationControllerDidDismiss`）に下ろす。数え漏らしに備え、`perform`は表示中の画面があるときも送らない。

メニューの項目が選べるようになるのは、`webReady`や`commandState`を受けてSwiftUIがメニューを作り直した後である。その直前に押したキーはWebViewへ落ちる。盤面の元に戻す・やり直すはWeb側のキー操作が受けるが、ほかのショートカットは何も起きない。UIテストはメニューの状態を読めないため、期待した画面が出るまでキーを送り直す（どの操作も、画面を出している間は重ねて実行されない）。

## Swift → Web

バックアップデータは次のCustomEventの`detail`へ渡す。

```json
{
  "filename": "chart.knit",
  "dataBase64": "..."
}
```

Web側はBase64を`File`へ戻し、既存の`.knit`インポート検証を通す。gzipは圧縮前32 MiB、解凍後256 MiB、編み図500件、ブロック5000件を上限とする。

## 書き出しの結果（Swift → Web）

`exportFile`に`id`があれば、Swiftは書き出しを終えたときに次のCustomEventを1回だけ送る（#122）。

```js
window.dispatchEvent(new CustomEvent('knittingEditorNativeExportFinished', { detail: { id: 'export-…', saved: true } }));
```

| 終わり方 | `saved` |
|---|---|
| 「ファイルに保存」で保存を終えた（`documentPicker(_:didPickDocumentsAt:)`） | `true` |
| 共有シートで共有を終えた（`completionWithItemsHandler`の`completed`が真） | `true` |
| 確認アラートの「キャンセル」 | `false` |
| 保存画面のキャンセル・下へスワイプして閉じた（`documentPickerWasCancelled(_:)`） | `false` |
| 共有シートを取り消した・閉じた（`completed`が偽） | `false` |
| 保存画面を出せない、一時ファイルを用意できない、メッセージを検証できない | `false`（`knittingEditorNativeError`も送る） |
| 結果の前に次の`exportFile`が届いた | 前の要求へ`false` |

Web側（`ios/Web/src/nativeBridge.ts`の`saveBlobWithNativeBridge`）は要求IDごとに結果を待ち、`iosPlatform.saveFile`が`SaveFileOutcome.saved`として返す。共有の編集画面は`saved`が`false`のときだけ最後のバックアップ日時を記録しない。このため「最後のバックアップ」は、保存・共有を終えた日時になり、取りやめたときは変わらず、書き出しを勧める帯も残る。PNG・PDFも同じ経路で結果を返すが、使い道はない（評価の依頼はSwift側で判定する）。

要求を送った文書が別の文書に置き換わったとき（使い方ページへ移った、同梱ページを読み直した）は、待っていたWebの処理ごと消えている。Swiftは`didCommit`で要求IDを捨て、新しい文書へ古い結果を送らない（一時ファイルは保存画面を閉じたときに消す）。Webは知らないIDの結果を捨て、`saved`が真偽値でない結果は不明（`undefined`）として扱う。不明のときは、Web版のダウンロードと同じく渡した時点を書き出した日時とする。

## アプリ情報（Swift → Web）

不具合の報告でどの版かを確かめられるよう、「使い方」の末尾にバージョンとビルド番号を表示する（#84）。Swiftは`Info.plist`の`CFBundleShortVersionString`と`CFBundleVersion`を`AppVersionInfo`で読み、`WKUserScript`（文書の読み込み開始時、メインフレームだけ）で次の値を置く。

```js
window.knittingEditorAppInfo = Object.freeze({ "build": "1", "version": "1.0" });
```

値はJSONとして埋め込み、文字列がスクリプトとして解釈されないようにする。`ios/Web/public/guide/index.html`はこの値があるときだけ「バージョン 1.0（ビルド 1）」をフッターへ`textContent`で表示し、無いとき（ブラウザで開いたときなど）は欄を隠したままにする。通信せずに表示でき、Web資産へバージョンを書き込まないので、`MARKETING_VERSION`・`CURRENT_PROJECT_VERSION`を上げるだけで表示も変わる。

## `.knit`登録

`com.k0mork.knitting-editor.knit`を`public.data`準拠の独自UTTypeとして`App/Info.plist`へ登録している。Files、AirDrop、他アプリからのOpen InはSwiftUIの`onOpenURL`で受け、同じWebインポート経路へ送る。

`LSSupportsOpeningDocumentsInPlace`を有効にしている（#149）。無効のままだと、Filesで`.knit`をタップしてもFilesのプレビューが開くだけで、アプリは起動しない（Simulatorで有効・無効を比べて確かめた）。有効にすると、Filesでタップした`.knit`は複製されず、利用者の原本のURLが`onOpenURL`へ届く。`WebViewModel.readIncomingBackup`は、読む間だけ`startAccessingSecurityScopedResource()`でアクセス権を得て、`NSFileCoordinator`（`.withoutChanges`）で他のアプリやiCloudの書き込みと調整して読む。iCloud Driveの原本は読む前にダウンロードを待つことがあるため、読み取りはメインスレッドの外で行う。原本へは書き戻さず、削除もしない。`.knit`は端末内へ復元するためのバックアップで、その場で編集するファイルではないので、タップするたびに新しい「（復元）」の編み図が増える（共有メニューから開いたときと同じ）。

AirDropや他のアプリの共有から受け取った`.knit`は、`Documents/Inbox`への複製となる。読み込み後に複製を削除して端末内へ蓄積させない。削除対象は`Documents/Inbox`配下とDocument Pickerが一時領域へ作る複製に限り、利用者の原本は削除しない。

編集画面以外（使い方ページ）を表示している間はバックアップイベントの購読者が存在しないため、`didCommit`で配送を保留し、編集画面が再び`webReady`を送ってから配送する。

## 互換fixture

`test-fixtures/knitting-editor-v2-interop.knit.b64`をWeb側の`.knit`復元fixtureとして管理する。Swiftブリッジテストは同じファイルをテストバンドルへ同梱して読み、Base64をテストコードへ複製しない。アプリは`.knit`のgzip JSONを解釈・再シリアライズせず、そのバイト列をDocument Picker、`onOpenURL`、WebViewイベントの間で搬送する。このため、fixtureをWeb側で復元できることと、Swiftブリッジでバイト列が変わらないことを別々に検証する。

Webのfixture復元、アプリWeb bundleのexport→bridge payload→import往復、Swiftのpayload保持、ready前後の配送方針を自動テストする。これはFiles／AirDropを使った実機往復の代替ではないため、実機またはTestFlightでの入出力確認は別の配布前ゲートとして残す。

## App Storeの評価の依頼

App Storeの評価は、StoreKitのシステムの依頼画面（`AppStore.requestReview(in:)`）だけで依頼する（App Review Guidelines 5.6.1）。独自の確認画面や、評価と引き換えの特典は出さない。判定は`ReviewRequestPolicy`（`App/ReviewRequest.swift`）にまとめ、`ReviewRequestTests`で確かめる。

依頼を検討するのは、PNGまたはPDFを「ファイルに保存」で保存し終えたとき（Document Pickerの`didPickDocumentsAt`）と、共有シートで共有を終えたとき（`completionWithItemsHandler`の`completed`が真）だけである。取り消したとき、`.knit`のバックアップを書き出したとき、編集の途中、起動直後には出さない。次の条件をすべて満たすときに依頼する。

| 条件 | 値 | 理由 |
|---|---|---|
| 初めて起動してからの時間 | 3日以上 | 初回の起動時や使い始めた直後には出さない。この版より前から使っている端末では、この版を初めて起動した日時から数える |
| 前回の依頼のあと（初めてなら最初から）にPNG・PDFを保存・共有し終えた回数 | 3回以上 | 編み図を何度か完成させ、使い続けている人にだけ聞く |
| 同じバージョンで依頼したか | していない | 同じ版では一度だけ |
| 前回の依頼からの時間 | 120日以上 | 新しい版になっても続けて聞かない |
| 画面の状態 | アプリが前面にあり、保存画面・共有シート・警告が出ていない | 保存画面が閉じ切るのを1秒待ってから確かめる |

依頼を試みたら、そのバージョンと日時を記録し、書き出しの回数を0へ戻す。画面の状態の条件を満たさず出せなかったときは記録せず、次の書き出しで改めて判定する。記録は`UserDefaults`（`reviewRequest.`で始まるキー）に置き、端末の外へは送らない。

システムは条件を満たしても画面を出さないことがあり、出たかどうかはアプリから分からない。同じアプリで1年に3回までしか表示されず、TestFlightでは表示されない。開発ビルド（Xcodeから実行したSimulator・実機）では毎回表示されるが、送信はされない。このため、表示の確認はSimulatorで行い、表示条件は単体テストで確かめる。Simulatorで条件を満たした状態を作るには、アプリを止めてから`reviewRequest.firstLaunchDate`を3日以上前の日時へ書き換え、PNGかPDFを3回保存する。

「使い方」からApp Storeのレビューを書くページ（`https://apps.apple.com/app/id<App ID>?action=write-review`）へのリンクは、App IDが決まっていないため、まだ置かない（#84）。

## 実機確認

iPad Air（第5世代）ではPNG、PDF、`.knit`のFiles保存、共有シート、Filesから開く経路、Document Picker経路を確認済みである。iPhone 17では`.knit`のFiles保存まで確認した。iPhoneでのPNG／PDF保存と復元、両端末での異常系、TestFlightビルドによる最終往復は未完了であり、`REAL_DEVICE_RELEASE_CHECKLIST.md`をリリース判定の正とする。
