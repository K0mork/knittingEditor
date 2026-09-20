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

Swiftはファイル種別、ファイル名、Base64、128 MiBの上限を検証し、失敗時は`knittingEditorNativeError`イベントを発生させる。出力は一時ファイルを介して「ファイルに保存」または共有シートへ渡す。

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

## 未完了の実機確認

Simulator／実機でのFiles、AirDrop、共有先、アプリ再起動を伴う往復試験は、利用可能な起動済み端末がないため未実施である。M5のXCUITestとリリース候補の機内モード試験で完了させる。
