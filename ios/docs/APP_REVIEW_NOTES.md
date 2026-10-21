# App Review notes

App Store Connectの審査メモには、英語と日本語の両方を転記する。アプリの画面は日本語だけなので、英語の手順にはボタンの日本語名を添え、日本語を読めない審査担当者でも手順をたどれるようにする（#292）。ボタン名を変えたときは、両方の手順を直す。

## English

### About Guideline 4.2

This app is not a wrapper that only displays a website. The editing engine is bundled in the app, and the following work completes even in Airplane Mode:

- Editing knitting charts on a canvas with 29 stitch symbols, with pan and pinch zoom
- Automatic saving to on-device storage (IndexedDB), flushed when the app moves to the background
- Generating PNG images, single-page PDFs, and A4 tiled PDFs
- Compressing, validating, and restoring `.knit` backups
- Saving to on-device storage in Files and opening local `.knit` files from Files or other apps
- Adaptive layouts for iPhone and iPad (including resizable windows), VoiceOver labels, and in-app input dialogs

The app also supports sharing through the native share sheet, including AirDrop. These destinations can be checked separately from the offline steps below, with the required connections enabled.

The app does not load any external website to start the editor. It opens Safari only when the user taps the support page or app privacy policy link in the in-app guide, and opens Mail only when the user taps the support email address. There are no accounts, servers, ads, analytics SDKs, or remote configuration.

### How to review

The app's interface is in Japanese. Button names are shown as "English (日本語)".

1. Turn on Airplane Mode and launch the app.
2. Tap "Charts (編み図)" at the top right, then "New chart (新しい編み図)". Enter a chart name and tap "Confirm (決定)" to create it. Choose a stitch with the stitch button (for example "表目") next to the color, make sure "Draw (描く)" is selected, and tap or drag on the grid to place several stitches.
3. Move the app to the background, return to it, and confirm the edits are still there.
4. Tap "Export (出力)" (at the bottom on iPhone, in the column on the right on iPad). Export a PNG with "Save PNG (PNGを保存)", a PDF with "Save PDF (PDFを保存)", and a `.knit` backup with "Export this chart (この編み図を書き出す)". For each file, choose "Save to Files (ファイルに保存)" in the confirmation dialog, select "On My iPhone (このiPhone内)" or "On My iPad (このiPad内)", and complete the save to keep the file available offline.
5. In the same panel, tap "Restore from backup (バックアップから復元)" and choose the `.knit` file from the on-device location used in step 4, or open that file from the Files app. Confirm the restored chart.
6. Tap "Guide (使い方)" at the top right and read the "Privacy (プライバシー)" section. The app privacy policy (https://knittingeditor.com/privacy/app/) in the Privacy section and the support page link in the "Support (サポート)" section open in Safari only when tapped and can be checked while online. The email link opens Mail only when the user taps it.

## 日本語

### Review guideline 4.2 に関する説明

本アプリは、Webサイトを表示するだけのラッパーではありません。編集エンジンはアプリバンドルへ同梱し、機内モードでも次の処理を完了できます。

- 29種類の編み目記号を使ったCanvas編集、パン、ピンチズーム
- IndexedDBへの自動保存とscene phase連動の保存flush
- PNG、1ページPDF、A4分割PDFの生成
- `.knit`バックアップの圧縮、検証、復元
- Filesの端末内保存先への保存、Filesや他アプリからの端末内の`.knit`受け入れ
- iPhoneとiPadの可変幅レイアウト、VoiceOver向けラベル、アプリ内入力ダイアログ

ネイティブの共有シートによる共有（AirDropを含む）にも対応しています。これらの共有先は、必要な接続を有効にした状態で、下記の機内モードの手順とは別に確認できます。

外部Webサイトは編集画面の起動に使いません。アプリ内ヘルプからユーザーが明示的にサポートページまたはアプリのプライバシーポリシーへのリンクを選んだ場合だけSafariを、サポートのメールアドレスを選んだ場合だけメールアプリを開きます。アカウント、サーバー、広告、分析SDK、リモート設定はありません。

### 審査時の確認手順

1. 機内モードで起動する。
2. 右上の「編み図」から「新しい編み図」を押し、編み図名を入力して「決定」を押す。色の隣の記号のボタン（「表目」など）で記号を選び、「描く」が選ばれた状態で盤面をタップまたはなぞって、複数の記号を置く。
3. アプリをバックグラウンドへ移し、戻って編集内容を確認する。
4. 「出力」（iPhoneでは画面の下、iPadでは右の列）を開き、「PNGを保存」「PDFを保存」「この編み図を書き出す」（`.knit`）でそれぞれ出力する。各ファイルの確認画面で「ファイルに保存」を選び、保存先を「このiPhone内」または「このiPad内」にして保存を完了する。端末内へ保存することで、機内モードのまま次の復元を確認できる。
5. 同じ画面の「バックアップから復元」で手順4の端末内の保存先から`.knit`を選ぶか、Filesからそのファイルを開き、復元された編み図を確認する。
6. 右上の「使い方」を開き、「プライバシー」の本文を確認する。アプリのプライバシーポリシー（https://knittingeditor.com/privacy/app/）へのリンクは、タップした場合だけSafariで開く。「サポート」のサポートページへのリンクはネットワーク接続時に確認する。メールのリンクは利用者が選んだ場合だけメールアプリを開く。
