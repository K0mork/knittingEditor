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

## Swift → Web

バックアップデータは次のCustomEventの`detail`へ渡す。

```json
{
  "filename": "chart.knit",
  "dataBase64": "..."
}
```

Web側はBase64を`File`へ戻し、既存の`.knit`インポート検証を通す。gzipは圧縮前32 MiB、解凍後256 MiB、編み図500件、ブロック5000件を上限とする。

## アプリ情報（Swift → Web）

不具合の報告でどの版かを確かめられるよう、「使い方」の末尾にバージョンとビルド番号を表示する（#84）。Swiftは`Info.plist`の`CFBundleShortVersionString`と`CFBundleVersion`を`AppVersionInfo`で読み、`WKUserScript`（文書の読み込み開始時、メインフレームだけ）で次の値を置く。

```js
window.knittingEditorAppInfo = Object.freeze({ "build": "1", "version": "1.0" });
```

値はJSONとして埋め込み、文字列がスクリプトとして解釈されないようにする。`ios/Web/public/guide/index.html`はこの値があるときだけ「バージョン 1.0（ビルド 1）」をフッターへ`textContent`で表示し、無いとき（ブラウザで開いたときなど）は欄を隠したままにする。通信せずに表示でき、Web資産へバージョンを書き込まないので、`MARKETING_VERSION`・`CURRENT_PROJECT_VERSION`を上げるだけで表示も変わる。

## `.knit`登録

`com.k0mork.knitting-editor.knit`を`public.data`準拠の独自UTTypeとして`App/Info.plist`へ登録している。Files、AirDrop、他アプリからのOpen InはSwiftUIの`onOpenURL`で受け、同じWebインポート経路へ送る。

`LSSupportsOpeningDocumentsInPlace`は無効のため、受け取った`.knit`は`Documents/Inbox`への複製となる。読み込み後に複製を削除して端末内へ蓄積させない。削除対象は`Documents/Inbox`配下とDocument Pickerが一時領域へ作る複製に限り、利用者の原本は削除しない。

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
