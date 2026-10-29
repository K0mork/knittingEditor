# スクリーンショット

## App Store Connect提出用（最終版）

2026-10-20に撮り直し、使う画面・枚数・文面を決めた（#290）。6.9インチiPhone（1320×2868）と13インチiPad（2064×2752）のそれぞれに、同じ順で5枚を登録する。2026-10-29にiPhone Duoの外側・内側の画面を同じ順と文面で足した（#353、[下の節](#iphone-duo)）。

App Store Connectが必ず求めるのは、iPhoneは「iPhone with Dynamic Island (medium display)」（縦1179×2556または1206×2622）、iPadは13インチ（[スクリーンショットの仕様](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)、2026-10-29に確認）。1320×2868は「large display」の大きさで、仕様のページには、medium displayの画像が無いときは大きい画面の画像を縮小して使う、とある。ただ、6.9インチの画像だけで提出できるかはページからは判断できないので、加入後にApp Store Connectで確かめる（#353）。

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

### iPhone Duo

2027年4月から、iOS 27.1 SDK以降でビルドしたアプリにはiPhone Duoのスクリーンショットが必要になる（[Appleの告知](https://developer.apple.com/news/?id=kkphp5qo)、2026-10-05）。このアプリは提出用のアーカイブをXcode 27.1以降で作るので（[提出チェックリスト](APP_STORE_CHECKLIST.md)）、2027年4月以降の提出では、v1.0でも更新版でも登録する。

仕様のページには外側の画面（閉じた状態、縦1398×2034）と内側の画面（開いた状態、縦2007×2853）の大きさが載っているが、どちらが必須かは書かれていない。そのため両方を撮り、どちらも上と同じ5つの画面・順・文面にした（2026-10-29、#353）。外側・内側のどちらが必須か、縦と横のどちらでもよいか、何枚から登録できるかは、加入後にApp Store Connectで確かめる（#353）。

| 順 | 説明文 | 外側（1398×2034） | 内側（2007×2853） |
| ---: | --- | --- | --- |
| 1 | 29種類の編み目記号で作る | [app-store-iphone-duo-outer-01-editor.png](screenshots/app-store-iphone-duo-outer-01-editor.png) | [app-store-iphone-duo-inner-01-editor.png](screenshots/app-store-iphone-duo-inner-01-editor.png) |
| 2 | 記号は一覧から選ぶだけ | [app-store-iphone-duo-outer-02-stitches.png](screenshots/app-store-iphone-duo-outer-02-stitches.png) | [app-store-iphone-duo-inner-02-stitches.png](screenshots/app-store-iphone-duo-inner-02-stitches.png) |
| 3 | PDFにしてA4で印刷 | [app-store-iphone-duo-outer-03-export.png](screenshots/app-store-iphone-duo-outer-03-export.png) | [app-store-iphone-duo-inner-03-export.png](screenshots/app-store-iphone-duo-inner-03-export.png) |
| 4 | 背景色を変えて見やすく | [app-store-iphone-duo-outer-04-background.png](screenshots/app-store-iphone-duo-outer-04-background.png) | [app-store-iphone-duo-inner-04-background.png](screenshots/app-store-iphone-duo-inner-04-background.png) |
| 5 | ダークモードにも対応 | [app-store-iphone-duo-outer-05-dark.png](screenshots/app-store-iphone-duo-outer-05-dark.png) | [app-store-iphone-duo-inner-05-dark.png](screenshots/app-store-iphone-duo-inner-05-dark.png) |

写っているものは上の5枚と同じで、外側・内側とも40段×32目の全体が見える。iPhone Duoでは記号の選択と出力のパネルが下から出るので、2枚目・3枚目はiPadと見え方が違う。

取得条件:

- `main`の`1d2411d`をXcode 27.1（27A9275）でRelease設定でビルドし、使い回しのSimulator「KE verify iPhone Duo」（iPhone Duo、iOS 27.1）で撮った。撮影の前にアプリを入れ直し、撮影のあとでアプリを消した。
- 開閉と内側の画面の向きは、Xcode 27の`DeviceHub.app`で切り替えた（`simctl`では切り替えられない）。内側は開いた直後は横向きで表示されるので、縦に回してから撮った。外側の画面は、カメラとステータスバーが画面の右上に縦に並ぶ作りで、そのまま撮った。
- 画像はiOS Simulatorの画面を撮るツールで撮った。`xcrun simctl io <端末> screenshot`は外側の画面しか撮れない。
- ステータスバーは上と同じ`xcrun simctl status_bar`の指定で固定した。
- 編み図は上と同じ作り方の「アラン模様のベスト」（40段×32目）を`.knit`で読み込み、名前の「（復元）」を外した。2本指で縮小・移動して、盤面の全体が見えるようにした。
- 4枚目の背景色（`#fff2d5`）は、このSimulatorでは「ほかの色を選ぶ」から色の選択画面が開かなかったため、`backgroundColor`を入れた同じ編み図の`.knit`を読み込んで付けた。色は上の5枚と同じ。
- 開閉したあと、盤面が画面の一部にしか描かれないことがあった。アプリを起動し直すと直ったので、外側は起動し直してから撮った（#367で扱う）。
- 帯と文字は上と同じ決まりで付けた。文字の大きさは、幅が1500未満の外側は幅の6.8%（95px）、内側は幅の5%（100px）で、上の5枚と同じ計算にした。

## 説明文を入れる（最終版）

2026-10-09に、最終版のスクリーンショットには機能を説明する短い文を入れると決めた（#85）。2026-10-20に上の5枚で作った。

- 1枚に1つの文を、画面の上の帯に置く。文は全角16文字以内にし、iPhoneの縮小表示でも読める大きさにする。
- 帯の色はアプリのヘッダーの緑（`#346f42`）、文字は白にする（コントラスト比6.0:1）。
- 画面の部分は撮ったものを縮小して帯の下に置き、加工しない（実際にない機能や表示を描き足さない）。
- 仕上がりの解像度は提出サイズ（iPhone 6.9インチは1320×2868、iPad 13インチは2064×2752、iPhone Duoは外側1398×2034・内側2007×2853）のままにする。
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
- ステータスバーはSimulatorの表示を含む。起動画面の色・Safe Areaと解像度の確認用で、提出には使わない。提出には上の「App Store Connect提出用（最終版）」を使う。
- iOS／iPadOS 27.0の2枚は最新OSの実UI確認証跡であり、XcodeBuildMCPの最適化スクリーンショットを含むため提出用解像度ではない。
