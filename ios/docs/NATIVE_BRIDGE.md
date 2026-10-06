# Native bridge specification

M3では、編集機能をWeb資産に残し、ファイル操作だけをiOSネイティブへ委譲する。WebViewがない通常のブラウザでは、既存の`<a download>`と`<input type=file>`へフォールバックする。

## Web → Swift

`window.webkit.messageHandlers.knittingEditor.postMessage()`へ次のJSONオブジェクトを送る。

```json
{
  "version": 1,
  "type": "exportFile",
  "filename": "chart.png",
  "mimeType": "image/png",
  "dataBase64": "..."
}
```

バックアップの読み込み要求は`{"version":1,"type":"openBackup"}`。Swift側は`UIDocumentPickerViewController`で`.knit`を選択し、読み取ったデータをWebViewへ返す。

WebViewがReactのバックアップイベント購読まで完了したら、`{"version":1,"type":"webReady"}`を送る。Swift側はこの通知前に受け取ったOpen URLのバックアップを保持し、通知後に一度だけWebViewへ配送する。これにより、起動直後やアプリ更新直後のイベント取りこぼしを防ぐ。

Swiftはファイル種別、ファイル名、Base64、128 MiBの上限を検証し、失敗時は`knittingEditorNativeError`イベントを発生させる。出力は一時ファイルを介して「ファイルに保存」または共有シートへ渡す。

`UIDocumentPickerViewController`は取り込みと書き出しのどちらでも`documentPicker(_:didPickDocumentsAt:)`を呼ぶため、Coordinatorは提示時の用途を保持し、書き出し完了のURLを取り込みとして扱わない。書き出しの一時ファイルは完了・キャンセルのどちらでも削除する。

## メニューバーとキーボードショートカット

iPadのメニューバーと、⌘キーの長押しで出るショートカットの一覧へ、編集画面の操作を載せる（#80）。項目はSwiftUIの`.commands`（`App/EditorCommands.swift`の`EditorCommands`）で定義し、選ばれたらSwiftは次のCustomEventをWebViewへ送るだけにする。操作の中身は画面のボタンと同じWeb側の処理で、Swiftに複製しない。

```js
window.dispatchEvent(new CustomEvent('knittingEditorNativeCommand', { detail: 'undo' }));
```

| メニュー | 項目 | キー | `detail` | Web側の処理 |
|---|---|---|---|---|
| ファイル | 新しい編み図… | ⌘N | `newDocument` | 「編み図」パネルの「新しい編み図」 |
| ファイル | バックアップから復元… | ⌘O | `restoreBackup` | 「復元」。`openBackup`でDocument Pickerを開く |
| ファイル | この編み図をバックアップ… | ⌘S | `exportBackup` | 「この編み図」の`.knit`書き出し |
| ファイル | 全データをバックアップ… | ⌥⌘S | `exportAllBackup` | 「全データ」の`.knit`書き出し |
| ファイル | PNGで書き出す… | ⇧⌘E | `exportPng` | 「PNGを保存」。画素数は保存・出力パネルを初めて開いたときの既定値 |
| ファイル | PDFで書き出す… | ⌘P | `exportPdf` | 「PDFを保存」。全体を1ページ・A4縦（パネルの既定値） |
| 編集 | 元に戻す | ⌘Z | `undo` | 操作メニューの「元に戻す」 |
| 編集 | やり直す | ⇧⌘Z | `redo` | 操作メニューの「やり直す」 |
| ヘルプ | 棒針編み図の使い方 | ⇧⌘H | `openGuide` | 「使い方」。保留中の保存を書き込んでから移る |

Web側は`ios/Web/src/nativeBridge.ts`の`listenNativeCommand`で受け、`NATIVE_COMMANDS`に無い値は捨てる。`nativeCommands.ts`の`runNativeCommand`は次のときに操作を始めない。

- 出力や復元の処理中（`busy`）。
- アプリ内ダイアログや記号の一覧（`aria-modal="true"`）を開いている間。ただし元に戻す・やり直すは、Web版のキー操作（`useHistoryShortcuts`）と同じく受け付ける。
- 入力欄で文字を打っている間の元に戻す・やり直すは、盤面ではなく入力中の文字に効かせる（`document.execCommand`）。

標準の「取り消す」「やり直す」（UIKitの`undo:`・`redo:`）はWeb側の編集履歴に届かないため、`CommandGroup(replacing: .undoRedo)`で置き換える。選べる状態のメニュー項目にショートカットが合うと、UIKitがキーを受け取り、WebViewの`keydown`へは届かない。このため⌘Z・⇧⌘ZはWeb側のキー操作（`useHistoryShortcuts`）と二重には実行されない（`KeyboardCommandUITests`で、1回の⌘Zで1件だけ戻ることを確かめている）。項目を選べないとき（戻せる編集が無いときなど）は、キーはこれまでどおりWebViewへ届く。

ページに`keydown`が届かないと、Web側は物理キーボードがあることに気付けず、記号の一覧の「Escapeで閉じます。」などの案内を出さない。Web側はネイティブの操作を受けたら`noteHardwareKeyboard()`（`packages/editor-core/ui/inputEnvironment.ts`）でキーボードがあるとみなす。メニューバーを指で開いて選んだときも同じ扱いになるが、案内が1文増えるだけである。

使い方のキーは、慣習の⌘?（⇧⌘/）にするとメニューには載るものの、iPadのSimulatorで押しても項目が呼ばれなかったため、⇧⌘H（Help）にした。

メニューの項目は、編集画面が`webReady`を送ってから、使い方ページなどへ移るまでの間だけ選べる。元に戻す・やり直すは、Webが編集履歴の状態を次のメッセージで知らせ、画面のボタンと同じ条件で選べるようにする。

```json
{ "version": 1, "type": "commandState", "canUndo": true, "canRedo": false }
```

Swiftは保存画面・共有シート・Document Pickerなどを表示している間は操作を送らない。新しい操作のたびにWeb側で別の出力やダイアログが重なるのを防ぐためである。

## Swift → Web

バックアップデータは次のCustomEventの`detail`へ渡す。

```json
{
  "filename": "chart.knit",
  "dataBase64": "..."
}
```

Web側はBase64を`File`へ戻し、既存の`.knit`インポート検証を通す。gzipは圧縮前32 MiB、解凍後256 MiB、編み図500件、ブロック5000件を上限とする。

## `.knit`登録

`com.k0mork.knitting-editor.knit`を`public.data`準拠の独自UTTypeとして`App/Info.plist`へ登録している。Files、AirDrop、他アプリからのOpen InはSwiftUIの`onOpenURL`で受け、同じWebインポート経路へ送る。

`LSSupportsOpeningDocumentsInPlace`は無効のため、受け取った`.knit`は`Documents/Inbox`への複製となる。読み込み後に複製を削除して端末内へ蓄積させない。削除対象は`Documents/Inbox`配下とDocument Pickerが一時領域へ作る複製に限り、利用者の原本は削除しない。

編集画面以外（使い方ページ）を表示している間はバックアップイベントの購読者が存在しないため、`didCommit`で配送を保留し、編集画面が再び`webReady`を送ってから配送する。

## 互換fixture

`test-fixtures/knitting-editor-v2-interop.knit.b64`をWeb側の`.knit`復元fixtureとして管理する。Swiftブリッジテストは同じファイルをテストバンドルへ同梱して読み、Base64をテストコードへ複製しない。アプリは`.knit`のgzip JSONを解釈・再シリアライズせず、そのバイト列をDocument Picker、`onOpenURL`、WebViewイベントの間で搬送する。このため、fixtureをWeb側で復元できることと、Swiftブリッジでバイト列が変わらないことを別々に検証する。

Webのfixture復元、アプリWeb bundleのexport→bridge payload→import往復、Swiftのpayload保持、ready前後の配送方針を自動テストする。これはFiles／AirDropを使った実機往復の代替ではないため、実機またはTestFlightでの入出力確認は別の配布前ゲートとして残す。

## 実機確認

iPad Air（第5世代）ではPNG、PDF、`.knit`のFiles保存、共有シート、Filesから開く経路、Document Picker経路を確認済みである。iPhone 17では`.knit`のFiles保存まで確認した。iPhoneでのPNG／PDF保存と復元、両端末での異常系、TestFlightビルドによる最終往復は未完了であり、`REAL_DEVICE_RELEASE_CHECKLIST.md`をリリース判定の正とする。
