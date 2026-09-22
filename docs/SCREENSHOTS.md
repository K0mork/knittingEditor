# スクリーンショット

## App Store Connect提出サイズ

App Store Connectは6.9インチiPhone（1320×2868）と13インチiPad（2064×2752）のスクリーンショットを要求する。以下は2026-09-22にその解像度で取得した素材である。

| 対象 | 解像度 | ファイル |
| --- | ---: | --- |
| iPhone 6.9インチ（iPhone 16 Pro Max Simulator）編集画面 | 1320×2868 | [app-store-iphone-6.9-editor.png](screenshots/app-store-iphone-6.9-editor.png) |
| iPad 13インチ（iPad Pro 13-inch M4 Simulator）編集画面 | 2064×2752 | [app-store-ipad-13-editor.png](screenshots/app-store-ipad-13-editor.png) |
| iPhone 6.9インチ 起動画面 | 1320×2868 | [app-store-iphone-6.9-launch.png](screenshots/app-store-iphone-6.9-launch.png) |

取得条件:

- 編集画面は40段×32列の「サンプル編み図」を表示し、盤面が画面いっぱいに広がって余白が出ないことを確認した。iPadで空白が目立った問題は、ビューポートを変えるのではなく盤面の段数・列数を増やして解消している。
- iPad素材は`TEST_RUNNER_KNITTING_EDITOR_SCREENSHOT_ROWS=40 TEST_RUNNER_KNITTING_EDITOR_SCREENSHOT_COLS=32`を付けて`testPrepareScreenshotBoard`を実行し、「上に段」「右に列」を繰り返し押して盤面を拡大したうえで記号を6個置いて取得した。
- iPhone素材は同じ内容を再現するため、iPad Simulatorのアプリデータコンテナ配下`Library/WebKit`をiPhone Simulatorへコピーしてから起動して取得した。iPhoneでの`testPrepareScreenshotBoard`実行は数値入力の不安定さで失敗するため、この手順を用いている。
- 起動画面は`UILaunchScreen`の`LaunchBackground`が全面に出ている状態を取得した。iPadの同等カットは撮影時に「編み図を準備しています。」の読み込み表示へ進んでいたため採用していない。
- 端末内のテストデータや個人情報は含めていない。ステータスバーはSimulatorの表示を含む。
- 実機での撮り直しは任意。App Store Connectの解像度要件はこの素材で満たしている。

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
