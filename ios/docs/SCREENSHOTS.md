# スクリーンショット

## App Store Connect提出用（最終版）

2026-10-20に撮り直し、使う画面・枚数・文面を決めた（#290）。App Store Connectが求める6.9インチiPhone（1320×2868）と13インチiPad（2064×2752）のそれぞれに、同じ順で5枚を登録する。

| 順 | 説明文 | iPhone 6.9インチ | iPad 13インチ |
| ---: | --- | --- | --- |
| 1 | 29種類の編み目記号で作る | [app-store-iphone-6.9-01-editor.png](screenshots/app-store-iphone-6.9-01-editor.png) | [app-store-ipad-13-01-editor.png](screenshots/app-store-ipad-13-01-editor.png) |
| 2 | 記号は一覧から選ぶだけ | [app-store-iphone-6.9-02-stitches.png](screenshots/app-store-iphone-6.9-02-stitches.png) | [app-store-ipad-13-02-stitches.png](screenshots/app-store-ipad-13-02-stitches.png) |
| 3 | PDFにしてA4で印刷 | [app-store-iphone-6.9-03-export.png](screenshots/app-store-iphone-6.9-03-export.png) | [app-store-ipad-13-03-export.png](screenshots/app-store-ipad-13-03-export.png) |
| 4 | 背景色を変えて見やすく | [app-store-iphone-6.9-04-background.png](screenshots/app-store-iphone-6.9-04-background.png) | [app-store-ipad-13-04-background.png](screenshots/app-store-ipad-13-04-background.png) |
| 5 | ダークモードにも対応 | [app-store-iphone-6.9-05-dark.png](screenshots/app-store-iphone-6.9-05-dark.png) | [app-store-ipad-13-05-dark.png](screenshots/app-store-ipad-13-05-dark.png) |

各画面に写っているもの:

1. 編集画面。アラン模様（ケーブル、ねじり目、透かし模様、ゴム編み）の40段×32目の編み図。
2. 記号の選択画面（基本・減目・交差の分類）。
3. 出力パネル（PNG、PDFの構成と用紙、バックアップ）。
4. 背景色を淡いクリーム色（`#fff2d5`、「ほかの色を選ぶ」）にした盤面。iPadは盤面設定のパネルも写る。
5. ダークモードの編集画面。

取得条件:

- `main`の`aa53a3a`をXcode 27.1でRelease設定でビルドし、Simulatorで撮った。iPhoneはiPhone 18 Pro Max、iPadはiPad Pro 13-inch (M5)で、どちらもiOS 27.0。画面の解像度がそのまま提出サイズになる。撮影用の端末は撮影のあとで削除した。
- ステータスバーは`xcrun simctl status_bar <端末> override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100`で固定した。
- 編み図は撮影のために作った「アラン模様のベスト」で、端末内のテストデータや個人情報は含まない。`.knit`で読み込み、名前の「（復元）」を外した。iPhoneでは盤面全体が幅に収まるよう、2本指で縮小して撮った。
- 4枚目は、iPhoneで背景色を選んだあと、端末内のデータ（アプリのコンテナの`Library/WebKit`）をiPadへ写して撮った。iPadのSimulatorでは「ほかの色を選ぶ」から色の選択画面が開かなかったため。アプリの不具合ではなく、色の選択画面を出すシステムのプロセスの起動が、Simulatorの起動直後やMacが重いときに間に合わず、システムが表示をやめるためだった（Safariでも同じ）。ほかの入力欄を押してから見本を押すか、パネルを開き直すと開く。
- iPadで外観を切り替えたあとに画面下のホームバーが出たままになったので、Simulatorを再起動してから撮り直した。
- 説明文の帯と文字は、下の「説明文を入れる（最終版）」の決まりに従って付けた。文字はヒラギノ丸ゴ ProN W4、帯の高さは画像の高さの17%で、画面の部分は残りの高さに合わせて縮小し、左右中央に置いた。

## 説明文を入れる（最終版）

2026-10-09に、最終版のスクリーンショットには機能を説明する短い文を入れると決めた（#85）。2026-10-20に上の5枚で作った。

- 1枚に1つの文を、画面の上の帯に置く。文は全角16文字以内にし、iPhoneの縮小表示でも読める大きさにする。
- 帯の色はアプリのヘッダーの緑（`#346f42`）、文字は白にする（コントラスト比6.0:1）。
- 画面の部分は撮ったものを縮小して帯の下に置き、加工しない（実際にない機能や表示を描き足さない）。
- 仕上がりの解像度は提出サイズ（iPhone 6.9インチは1320×2868、iPad 13インチは2064×2752）のままにする。
- 文は、その画面で実際に見せている機能だけを書く。

文の案（2026-10-20に、6つ目を除く5つを採用した。2つ目は「分類から」を「一覧から」に変えた）:

| 画面 | 文の案 |
| --- | --- |
| 記号を置いた編集画面 | 29種類の編み目記号で作る |
| 記号の選択画面 | 記号は分類から選ぶだけ |
| PDFの保存画面または出力したPDF | PDFにしてA4で印刷 |
| 背景色を変えた盤面 | 背景色を変えて見やすく |
| ダークモードの編集画面 | ダークモードにも対応 |
| 機内モードでの編集画面 | 通信なしで使えて自動保存 |

## 旧下書き（解像度確認用、提出には使わない）

| 対象 | 解像度 | 下書き |
| --- | ---: | --- |
| iPhone 16 Simulator | 1179×2556 | [iphone-16-editor-simulator.png](screenshots/iphone-16-editor-simulator.png) |
| iPad (10th generation) Simulator | 1640×2360 | [ipad-10-editor-simulator.png](screenshots/ipad-10-editor-simulator.png) |
| iPad (10th generation) Simulator 横画面 | 2360×1640 | [ipad-10-editor-landscape-simulator.png](screenshots/ipad-10-editor-landscape-simulator.png) |
| iPhone 18 Pro Simulator（iOS 27.0、最新OS確認用） | 368×800 | [iphone-18-pro-ios-27-editor-simulator.jpg](screenshots/iphone-18-pro-ios-27-editor-simulator.jpg) |
| iPad Pro 11-inch (M5) Simulator（iPadOS 27.0、最新OS確認用） | 1668×2420 | [ipad-pro-11-ios-27-editor-simulator.png](screenshots/ipad-pro-11-ios-27-editor-simulator.png) |
| iPhone 16 Simulator 起動画面 | 1179×2556 | [iphone-16-launch-simulator.png](screenshots/iphone-16-launch-simulator.png) |
| iPad (10th generation) Simulator 起動画面 | 1640×2360 | [ipad-10-launch-simulator.png](screenshots/ipad-10-launch-simulator.png) |

取得条件:

- `com.k0mork.knittingEditor`をSimulatorへ新規インストールし、初期の「新しい編み図」を表示した。
- iPad横画面は`testPrimaryControlsRemainUsableInPortraitAndLandscape`の横画面安定後に取得し、画面全体の主要操作が見えることを確認した。
- アプリを削除して再インストールした直後に起動し、`UILaunchScreen`表示中の画面を取得した。
- 端末内のテストデータや個人情報は含めていない。
- ステータスバーはSimulatorの表示を含む。起動画面の色・Safe Areaと解像度の確認用であり、App Store Connect登録前に実機またはTestFlightで撮り直す。
- これらはSimulator下書きであり、App Store Connect向けの実機／TestFlight最終素材ではない。
- iOS／iPadOS 27.0の2枚は最新OSの実UI確認証跡であり、XcodeBuildMCPの最適化スクリーンショットを含むため提出用解像度ではない。
