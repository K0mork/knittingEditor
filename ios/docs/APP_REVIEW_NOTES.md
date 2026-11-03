# App Review notes

App Store Connectの審査メモ（App Review Informationの「メモ」）には、「## English」から最後までを転記する。メモは4000文字までなので、英語と日本語を合わせてこの範囲に収める。転記した先では書式が付かないため、本文には太字やコードの書式を使わない。アプリの画面は日本語だけなので、英語の手順にはボタンの日本語名を添え、日本語を読めない審査担当者でも手順をたどれるようにする（#292）。ボタン名を変えたときは、両方の手順を直す。

画面のボタンに出ない操作（ジェスチャー、キーボードショートカット、Apple Pencil、システムが出す画面など）は、審査担当者が気づきにくい。App Review Guidelines 2.5.19は説明のない機能を禁じているので、こうした操作を足したり変えたりしたときは、アプリ内の「使い方」と、ここの「Other input methods」「画面のボタン以外の操作」の両方を直す（#352）。更新版を提出するときの手順は[提出手順の10](RELEASE_RUNBOOK.md#10-更新版を提出する)にある。

## English

### About this app

This app lets users create hand-knitting charts on iPhone and iPad. No account is needed, and the app has no servers, ads, or analytics.

Main features:

- Editing charts with 29 stitch symbols, with pan and pinch zoom
- Automatic saving on the device
- Exporting PNG images and PDFs (one page, or split across A4 pages)
- Backing up charts to .knit files and restoring them, including through the Files app
- Sharing exported files with the standard share sheet

### How to review

The app is in Japanese only. Below, each button is written as "English (日本語)"; the app shows the Japanese label.

1. Open the app.
2. Tap "Charts (編み図)" at the top right, then "New chart (新しい編み図)". Enter a name and tap "Confirm (決定)". Pick a stitch with the stitch button (e.g. "表目") next to the color. With "Draw (描く)" selected, tap or drag on the grid.
3. Send the app to the background, return, and check that the edits remain.
4. Tap "Export (出力)" (at the bottom on iPhone, in the right column on iPad). Use "Save PNG (PNGを保存)", "Save PDF (PDFを保存)", and "Export this chart (この編み図を書き出す)" for a .knit backup. Each time, choose "Save to Files (ファイルに保存)" and save to "On My iPhone (このiPhone内)" or "On My iPad (このiPad内)".
5. In the same panel, tap "Restore from backup (バックアップから復元)", choose the .knit file from step 4, and check the restored chart.
6. Tap "Guide (使い方)" at the top right. "Privacy (プライバシー)" explains data handling. Its privacy policy link and the support page link in "Support (サポート)" open in Safari.

### Other input methods

These have no on-screen button. They are optional, do the same as existing buttons, and are explained in "Guide (使い方)".

- Apple Pencil double-tap (iPad): switches between "Draw (描く)" and "Erase (消す)", following the double-tap setting in Settings > Apple Pencil.
- Keyboard shortcuts (iPad with a keyboard): ⌘N new chart, ⌘O restore, ⌘S back up this chart, ⌥⌘S back up all data, ⇧⌘E export PNG, ⌘P export PDF, ⌘Z undo, ⇧⌘Z redo, ⌘+ / ⌘− zoom, ⇧⌘H guide. The same commands are in the menu bar.
- Trackpad pinch (iPad): zooms the chart.

## 日本語

### アプリについて

本アプリは、棒針編みの編み図をiPhoneとiPadで作るためのアプリです。アカウント登録は不要で、サーバー、広告、利用分析はありません。

主な機能：

- 29種類の編み目記号による編み図の編集（移動、ピンチでの拡大・縮小）
- 端末内への自動保存
- PNG画像とPDF（1ページ、またはA4の複数ページ）の書き出し
- .knitファイルへのバックアップと復元（「ファイル」アプリからの読み込みを含む）
- 書き出したファイルの共有シートでの共有

### 審査時の確認手順

1. アプリを起動してください。
2. 右上の「編み図」から「新しい編み図」を押し、名前を入力して「決定」を押してください。色の隣の記号のボタン（「表目」など）で記号を選び、「描く」が選ばれた状態で盤面をタップまたはなぞってください。
3. アプリをバックグラウンドに移してから戻り、編集内容が残っていることを確認してください。
4. 「出力」（iPhoneでは画面の下、iPadでは右の列）を開き、「PNGを保存」「PDFを保存」「この編み図を書き出す」（.knit）でそれぞれ書き出してください。そのたびに「ファイルに保存」を選び、「このiPhone内」または「このiPad内」に保存してください。
5. 同じ画面の「バックアップから復元」を押し、手順4の.knitファイルを選んで、編み図が復元されることを確認してください。
6. 右上の「使い方」を開くと、「プライバシー」にデータの扱いが書かれています。そこにあるプライバシーポリシーと、「サポート」のサポートページへのリンクはSafariで開きます。

### 画面のボタン以外の操作

次の操作には画面上のボタンがありません。どれも任意で、既存のボタンと同じ処理を行い、「使い方」で説明しています。

- Apple Pencilのダブルタップ（iPad）：「描く」と「消す」を切り替えます。「設定」>「Apple Pencil」のダブルタップの設定に従います。
- キーボードショートカット（キーボードを接続したiPad）：⌘N 新しい編み図、⌘O 復元、⌘S この編み図をバックアップ、⌥⌘S 全データをバックアップ、⇧⌘E PNGで書き出す、⌘P PDFで書き出す、⌘Z 元に戻す、⇧⌘Z やり直す、⌘＋／⌘− 拡大／縮小、⇧⌘H 使い方。同じコマンドはメニューバーにもあります。
- トラックパッドのピンチ（iPad）：盤面を拡大・縮小します。
