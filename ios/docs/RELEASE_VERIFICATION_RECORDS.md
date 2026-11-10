# リリース確認の記録

[実機リリースゲート](REAL_DEVICE_RELEASE_CHECKLIST.md)と[App Store提出チェックリスト](APP_STORE_CHECKLIST.md)の確認を、実施した日ごとに古い順で残す。チェック欄と手順は各チェックリストを正とし、ここには実施した環境・結果・未実施項目だけを書く。新しい記録は末尾へ足し、同じ内容を`docs/dev-log/`の記録にも書く（[記録ルール](REAL_DEVICE_RELEASE_CHECKLIST.md#記録ルール)）。

## 2026-09-21 着手時の環境

| 項目 | 記録 |
|---|---|
| 実施日 | 2026-09-21（iPhone・iPadへ着手） |
| 実施者 | K0mork |
| Git commit | `aca03e8`時点のワークツリー（本記録と同じコミットで更新） |
| Xcode / macOS | Xcode 27.0 (27A266a) / macOS 27.0 |
| iPhone機種・iOS | iPhone 17 (iPhone18,3) / iOS 27.0 |
| iPad機種・iPadOS | iPad Air (5th generation) (iPad13,16) / iPadOS 27.0 |
| Apple Developer Team / Bundle ID | 無料Personal Team（今後、個人でApple Developer Programに加入する予定） / `com.k0mork.knittingEditor` |
| 署名方式・証明書 | Automatic、Apple Development（`iOS Team Provisioning Profile`、7日で失効） |

## 2026-09-21 実機実行記録（iPhone 17 / iOS 27.0）

実機リリースゲートのチェック欄は、目視・機内モード・計測を伴う項目が残っているため未完了のままとする。この日に実機で確認できた内容だけを記録する。

実施できたこと。

- 署名ビルド、インストール、起動。`ios/scripts/check-device-readiness.sh`が`Device release preflight is ready.`で通過。
- Swift単体テスト22件成功。実機のWebKitでローカルorigin読み込み、IndexedDB永続化、ネットワークAPI未使用検出が成立する。
- XCUITest 11件成功（2件はアプリ更新プローブのためスキップ）。起動、編集、自動保存、再起動復元、編み図切替、使い方ページ往復、PNG／PDFのネイティブ保存導線、キーボード表示中のダイアログ、縦横回転、最大Dynamic Typeを実機で通した。
- `.knit`書き出しのシステム保存シート表示と、シートを閉じて編集画面へ戻るところまでを自動化した。
- 利用者による手動確認: 保存シートから実際に`.knit`をFilesへ保存し、書き出し完了が取り込みとして処理されないこと（「〜（復元）」が増えないこと）を端末のIndexedDBを読み出して確認した。

実機で見つけて直したこと。

- 最大Dynamic Type かつ横向きで、ヘッダーの「編み図」`frame=(658, -58, 141x180)`、「使い方」`frame=(525, -36, 107x136)`が画面上端の外へ出て操作できなかった。`.app-header`の固定高を`min-height`へ変更し、ヘッダー操作の文字サイズ上限を全幅へ適用して解消した（修正後は`(714, 44, 84x81)`）。横向きの回帰テストを追加した。

残っていること。

- 機内モードでの起動と主要フロー、1000×1000盤面の時間・ピークメモリ測定、PNG／PDFのFiles実保存、AirDrop・共有先、`.knit`のAirDrop往復。
- VoiceOverのフォーカス順、Apple Pencil、タッチ・ピンチ・トラックパッド操作、文字の切れ・重なりの目視。
- iPad実機に関する全項目（未接続）。
- TestFlight・App Store提出（無料Personal Teamのため、有料加入後）。

## 2026-09-21 実機実行記録（iPad Air 第5世代 / iPadOS 27.0）

- デベロッパモードを有効化し、署名ビルド・インストール・起動を確認した。`ios/scripts/check-device-readiness.sh`はiPhoneとiPadの両方をオンライン端末として検出する。
- Swift単体テスト22件成功、XCUITest 11件成功（2件はアプリ更新プローブのためスキップ、206.5秒）。
- iPadで発見して直したもの。
  - 書き出しの保存シートは、iPadでは「×」が`label`の`Cancel`ボタンとして押せる（`frame=(14, 46, 36x36)`、`isHittable=true`）。iPhone向けに実装した下スワイプはiPadでは閉じられなかったため、押せる場合はボタンを使い、押せない場合だけスワイプへ落とすようにした。
  - ダイアログ入力で先頭文字を取りこぼしていた。`M2切替A`が`2切替A`になり、さらに初期値「新しい編み図」が消えずに残って`2切替A新しい編み図`という名前になっていた。キーボード表示を待ってから初期値を消して入力し、入力結果を検査するようにした。アプリ側も`window.prompt`と同じく初期値を選択状態にして開くようにした。
- 全画面（954x1373）、可変ウィンドウ（584x861）、Split View（681.5x954）のいずれでも、主要操作・各パネルの開閉・ダイアログ入力・盤面への描画が成立した。画面サイズは1373x954。`testManualWindowKeepsPrimaryFlowsUsable`として手順化してある。
- 未解決: iPad実機のフルスイートで`testBackupExportSheetDismissesBackToEditor`が断続的に失敗する（単独実行では毎回成功）。失敗時の診断情報と画面添付を入れてあるので、次に発生した結果bundleで切り分ける。
- 未実施: Apple Pencil、タッチ・ピンチ、VoiceOver、Files実保存とAirDrop、iPad版スクリーンショット。

## 2026-09-22 機内モード実施記録（iPad Air 第5世代 / iPadOS 27.0、有線）

オンラインで起動したアプリを前面に保ったまま機内モードへ切り替えて実施した。機内モードはステータスバーのアイコンを画面取得して確認した。

| 確認 | 結果 |
|---|---|
| 新規編み図の作成 | 「機内モード確認」を11:30:34に作成。端末内IndexedDBを有線で読み出して確認 |
| Canvas描画・Pointer Events | 盤面に6記号を配置し保存されている |
| Blob生成・PNG保存 | 完了（Filesへ保存） |
| Blob生成・PDF module Worker・PDF保存 | 完了（Filesへ保存） |
| `.knit`の圧縮・保存・復元 | 「機内モード確認（復元）」が11:35:15にIndexedDBへ作成され往復が成立 |
| アプリの生存 | PID 3127が継続。クラッシュログなし |
| 記号の描画 | 記号メニューで26記号すべてが同梱資産から描画された。うち基本4種・減目7種の計11記号は画面取得でも確認し、残りは利用者が目視で確認した |

未了だった機内モード前後の通信監視は、2026-10-02に実施した（下の「2026-10-02 機内モード前後の通信監視」）。

機内モードでの新規起動は、利用者が機内モード中にアプリを終了しホーム画面のアイコンから起動して確認済み。26記号の目視も利用者が機内モード中に確認した。記号メニューのスクロールは機内モード中に自動化できない（後述）が、26記号の定義とID、全記号のCanvas・PNG・PDF描画は自動テストでも担保している。

機内モード中はアプリへタップやスクロールを送れない。実機への入力注入はXCUITestしか手段がなく、XCUITestはアプリを再インストール・再起動するため、無料Personal Teamでは機内モードで起動できない。`devicectl`は画面取得・ファイル取得・プロセス確認などの観察系のみで入力系のサブコマンドを持たない。有料加入後は`testAirplaneModeServesEditorWithoutNetwork`で一連を自動化できる。

## 2026-09-22 1000×1000盤面の手動測定（iPhone 17）

手で1000×1000にした盤面で測った。保存1.1〜2.2秒、復元2.6〜2.7秒、20×20からのリサイズ1.8秒、記号配置の反映1.7秒。アプリ本体のフットプリント16.5 MiB／Resident 52 MiB。

## 2026-10-02 機内モード前後の通信監視（iPad Air 第5世代 / iPadOS 27.0、有線）

`main`の`6ad2592`を無料Personal Teamで署名して入れ、端末の通信をMacで記録しながら、利用者が次の操作を行った。

- A（オンライン）: アプリを終了してホーム画面から起動し、新しい編み図「通信確認」を作って記号を置き、PNG・PDF・`.knit`を「このiPad内」へ保存し、「使い方」を開いて編集画面へ戻った。
- B（機内モード）: Aと同じ操作を「通信確認2」で行った。
- C（機内モード解除後）: Wi-Fiの接続を確かめ、アプリを起動し直して記号を1つ置いた。

手順は[実機リリースゲートの「機内モード前後の通信監視の手順」](REAL_DEVICE_RELEASE_CHECKLIST.md#機内モード前後の通信監視の手順)。

結果:

- 記録は20:47:45から20:50:55まで。端末のIndexedDBを有線で読み出すと、「通信確認」の作成は20:48:24、「通信確認2」の作成は20:49:54（機内モード中で、通信がほぼ途絶えた区間）、最後の更新はCの20:50:50だった。A〜Cの操作はすべて記録の中にある。
- 送受信したプロセスは、`mDNSResponder`、`nsurlsessiond`、`cloudd`、`apsd`、`maild`など、iPadOSのシステムと他のアプリのものだけだった。`knittingEditor`と`com.apple.WebKit.*`の通信は1件も無く、DNSやiCloudプライベートリレーなどを経由した通信の元プロセス（`eproc`）にも、アプリは含まれていなかった。プロセスが付かないパケットは、DHCP、IPv6の近隣探索、Appleのネットワーク（17.0.0.0/8）への通信だけだった。
- 名前解決は暗号化されたDNSで行われていて、DNSの記録から問い合わせ先の名前はほとんど読めない。このため、判定はプロセス名を根拠にした。

記録ファイルには端末のMACアドレスやローカルネットワークのIPアドレスが含まれるので、リポジトリには入れていない。

## 2026-10-02・2026-10-06 1000×1000盤面の測定（M2）

[M2](REAL_DEVICE_RELEASE_CHECKLIST.md#m2-保存復元大規模盤面)の`ios/scripts/measure-large-board.sh`で測った。

| 測定 | 目標・判定 | iPhone 17 / iOS 27.0 | iPad Air 第5世代 / iPadOS 27.0 |
|---|---|---|---|
| 盤面変更（段数・列数の入力から1000×1000の表示まで） | 失敗・ハングなし | 16.3〜16.8秒 | 15.5〜17.2秒 |
| 記号配置の反映 | 失敗・ハングなし | 1.7〜1.8秒 | 2.0〜2.1秒 |
| 保存時間 | 失敗・ハングなし、実測値を記録 | 2.2秒 | 2.3秒 |
| バックグラウンドからの復帰 | 盤面と記号が残る | 1.2秒（残った） | 1.3秒（残った） |
| 復元時間（再起動から1000×1000と記号の表示まで） | 失敗・ハングなし、実測値を記録 | 2.5〜2.6秒 | 2.7〜2.9秒 |
| PNG出力（保存先を選ぶ画面まで） | エラーなく完了 | 1.6秒 | 2.8秒 |
| PDF出力（同上） | エラーなく完了 | 1.9秒 | 2.1〜2.2秒 |
| ピークメモリ（WebKitコンテンツプロセス） | 警告・強制終了なし、実測値を記録 | 537.0 MiB | 567.9 MiB |
| ピークメモリ（アプリ本体） | 同上 | 32.6 MiB | 40.7 MiB |

記録日はiPhoneが2026-10-06（3回）、iPadが2026-10-02と2026-10-06（各1回）。メモリはiPhoneが2026-10-06、iPadが2026-10-02の記録で、バックグラウンドからの復帰を測る手順はその後に加えたため、復帰は両端末とも2026-10-06の1回だけ測った。どちらも、WebKitのコンテンツプロセスが最大になったのは再起動後のPNG出力の直後で、PDF出力の直後はそれより小さかった。測定の間、WebKitのコンテンツプロセスは同じPIDのまま動き続け、端末のクラッシュ記録とJetsamEvent（メモリ不足による強制終了の記録）に、アプリとWebKitのものは無かった。

## 2026-10-09 実機確認記録（iPhone 17 / iOS 27.0、有線）

`main`の`40959f5`（#143まで）を無料Personal Teamで署名して入れた。#147の確認は、そのPRのブランチを入れて行った。

- XCUITest：文字サイズ最大の3件（`testAccessibilityExtraExtraExtraLarge…`）を各3回、計9回流し、すべて成功した。iOS 27のSimulatorで起動が「編み図を準備しています」から進まない件（#64）は、実機では起きなかった。続けてUIテスト全体（CIと同じく`testBackupExportSheetDismissesBackToEditor`を除く）を流し、実行した17件がすべて成功した（iPad用・測定用など9件は既定どおりスキップ）。
- 起動の画面収録（ライト）：起動の動きの緑と、「編み図を準備しています…」が出てからの緑は同じ色で、途中で色が変わるコマは無かった。iOS 27のSimulatorで起動画面の緑が鮮やかに見えた件（#117）は、実機では起きなかった。準備中の表示のあとに「編み図を読み込んでいます…」の画面は出ず、約0.3秒で編集画面へ移った。
- MacからAirDropで`.knit`を送り、受信画面に種類名「棒針編み図バックアップ」が日本語で出ることを利用者が確かめた（#82）。
- 「設定 > アクセシビリティ > ズーム」をオンにし、3本指ダブルタップで拡大して、ヘッダーと道具の文字を読める大きさにできることを利用者が確かめた（#81）。
- 1000×1000の盤面で、PNGの1セルの画素数を最大にして保存しようとすると、クラッシュせずに「一辺が上限16384pxを超えます。PDF保存をおすすめします。」と出ることを利用者が確かめた（#24、PR #147の文言）。
- M3・M4・M6の各項目は実機リリースゲートのチェック欄に書いた。
- 使ったテスト用の`.knit`のSHA-256：相互運用fixture（`AirDrop確認.knit`）`a902b24a5c26ed0481b72e3060932afa164fe8920a3a6a698acc6a13f26991d5`、不正形式`bf390681bb3e243b57609aa0f2869cbec9d310ef14a8d40bf371587fd60529a6`、巨大解凍データ`55e0fe7b35fd3935b2b315a111fe338512ece9c7c286277eb0ac9261911b3814`。iPhoneから送った`.knit`（20段×20目、記号82個）`6339ed79df2a722ba62fedeb1f199ac3c2139f0f0ae9c455342df612f30db4bf`。

## 2026-10-15 実機確認記録（iPad Air 第5世代 / iPadOS 27.0.1、有線）

`main`の`ffb662d`に、PNGの上限超過を確かめるUIテストを足したブランチを、無料Personal Teamで署名して入れた（Xcode 27.0）。

- XCUITest `testOversizedPngExplainsLimitAndDisablesSave`が成功した（54.2秒。値の読み方を直した最終版は47.3秒）。新しい編み図を1000×1000にし、出力パネルのPNGの「1セルの画素数」を最大の60pxまでドラッグすると、「60120×60120px — 一辺が上限16384pxを超えます」と「この盤面はPDF保存をおすすめします。」が出て、「PNGを保存」が押せなくなった。アプリは前面で動いたままだった。2pxへ戻すと、両方の表示が消えて「PNGを保存」が押せるようになった。画面写真で、右側の出力パネルに上の表示が出ていることを確かめた（#24）。
- 初回の実行は「UIオートメーションを有効にする」の確認に答えないまま約60秒が過ぎ、`Timed out while enabling automation mode.`で止まった。確認に答えて流し直すとテストが始まった。
- WebViewのスライダーは、XCUITestの`adjust(toNormalizedSliderPosition:)`で動かせなかった（つまみの位置の属性が0のまま返る）。今の値からつまみの位置を求めてドラッグするようにした。今の値はスライダーの名前（「1セルの画素数 7px」）から読む。横の値の表示は、iOS 26.5のSimulatorでは「7」と「px」の2つの要素に分かれるため使わない。

## 2026-10-21 起動画面の確認（Simulator）

`main`の`fda7bbf`をXcode 27.1でReleaseビルドし、KE verify iPhone・KE verify iPad（iOS 27.0 Simulator）へ入れ直して、ライト・ダークの両方で起動を録画した。どれも「起動画面（`LaunchBackground`の緑）→準備中の表示（同じ緑）→編集画面」と移り、白や黒の全面表示は1コマも出なかった。ダークでは編集画面も暗い配色になった。iOS 27のSimulatorで起動画面の緑が準備中の緑より鮮やかに見える件（#117）は変わらないが、実機では起きないことを2026-10-09にiPhone 17で確かめている（[`REAL_DEVICE_RELEASE_CHECKLIST.md`](REAL_DEVICE_RELEASE_CHECKLIST.md)）。提出ビルドでの最終確認は[`REAL_DEVICE_RELEASE_CHECKLIST.md`](REAL_DEVICE_RELEASE_CHECKLIST.md)のM6で行う

## 2026-10-21 提出用アーカイブの試作（手元のXcode 27.1）

手元のXcode 27.1（`27A9275`）で`main`の`fda7bbf`から署名なしのReleaseアーカイブを試しに作った（CIの`release_archive`と同じ引数）。アーカイブは成功し、`check-release-assets.sh`も通った。アプリの`Info.plist`は`DTSDKName`が`iphoneos27.1`、`DTXcodeBuild`が`27A9275`、`CFBundleShortVersionString`が`1.0`、`CFBundleVersion`が`1`だった。提出用は加入後に署名して作り直す。

## 2026-11-02 有料Teamでの署名と実機導入（iPhone 17 / iOS 27.2、iPad Air 第5世代 / iPadOS 27.2、有線）

Apple Developer Programへの個人での加入が有効になったあと、`main`の`c502259`を有料のTeamで署名して両端末へ入れた（#17）。

| 項目 | 記録 |
|---|---|
| 実施日 | 2026-11-02 |
| 実施者 | K0mork |
| Git commit | `main`の`c502259` |
| Xcode / macOS | Xcode 27.2 (27B52) / macOS 27.2 (26B123) |
| iPhone機種・iOS | iPhone 17 (iPhone18,3) / iOS 27.2 |
| iPad機種・iPadOS | iPad Air (5th generation) (iPad13,16) / iPadOS 27.2 |
| Apple Developer Team / Bundle ID | 有料（個人のApple Developer Program、XcodeのAccountsでの役割はAdmin） / `com.k0mork.knittingEditor` |
| 署名方式・証明書 | Automatic、Apple Development（`iOS Team Provisioning Profile: com.k0mork.knittingEditor`、作成から1年で失効） |

- XcodeのAccountsでTeamの表示から「(Personal Team)」が外れたことを利用者が確かめた。Xcodeの設定ファイルには加入前のTeamの情報が残っていたため、表示ではなく、`xcodebuild -allowProvisioningUpdates`で作られたProvisioning Profileの失効日（作成から1年。無料Personal Teamでは7日）で有料のTeamと判断した。
- `KNITTING_EDITOR_REQUIRE_WIRED=1 ios/scripts/check-device-readiness.sh`が両端末を`transport=wired`、デベロッパモード有効として通過した。`-allowProvisioningDeviceRegistration`を付けてビルドし、両端末がProvisioning Profileに入ったことを確かめた。
- 入れる前に、両端末のアプリのデータ（`Library`）を`devicectl device copy from`でMacへ写した。Debugビルドを上書きで入れ、`devicectl device process launch`で起動すると、開発元を信頼する操作なしで編集画面が出た。アプリを終了して起動し直しても、前に開いていた編み図と記号がそのまま表示された。端末内IndexedDBの`documents`の件数は、入れる前・入れた後・起動し直した後・下の自動テストの後で変わらなかった（iPhoneは35件、iPadは1件）。
- 機内モードの自動テスト`testAirplaneModeServesEditorWithoutNetwork`は、有料のTeamでも実機で流せなかった。両端末を機内モードにしてWi-Fiも切り、有線でiPhoneに`xcodebuild test`を実行すると（iPadは同じ理由で起動できないため流していない）、アプリを入れ直したあとの起動で`Unable to launch com.k0mork.knittingEditor because it has an invalid code signature, inadequate entitlements or its profile has not been explicitly trusted by the user`となり、iPhoneに「デベロッパの信用を確認するにはインターネット接続が必要です」と出た。直前にオンラインで同じテストを流して（環境変数なしのためスキップ）起動できたことを確かめてから機内モードに戻しても、入れ直したあとの起動は同じく拒否された。入れ直した開発ビルドは、起動の前にiOSがオンラインで開発元を確かめるためである。
- 残り：機内モードでの確認は、TestFlightで配る提出ビルドで行う（M6、#25）。

## 2026-11-02 Swift側の変換とファイル入出力の測定（#26、iPhone 17 / iOS 27.2、有線）

[Swift側の変換とファイル入出力（#26）](REAL_DEVICE_RELEASE_CHECKLIST.md#swift側の変換とファイル入出力26)の`ios/scripts/measure-bridge-io.sh`で、small・medium・largeを1回ずつ測った。`test/measure-native-bridge-io`ブランチの`3f498d8`を、有料のApple Developerのチームで署名したDebugビルドで入れた（Xcode 27.2（27B52））。測定は19:30〜20:00ごろ（日本時間）に行った。iPadは未実施で、次の機会に測る。

| サイズ | 編み図数（どれも1000×1000） | バックアップ（bytes） |
|---|---:|---:|
| small | 1 | 3959897 |
| medium | 4 | 15837839 |
| large | 8 | 31674921 |

largeは、Web側の圧縮後の上限（32 MiB）のすぐ下で、通常の復元で受け付ける最大の大きさにあたる。

UIテストで測った所要時間（秒）は次のとおり。テスト用データの生成（約4秒）は利用者の操作ではないので含めない。

| 測定 | small | medium | large |
|---|---:|---:|---:|
| バックアップの書き出し（保存先の選択が閉じるまで） | 14.5 | 14.3 | 15.6 |
| PNG保存（保存先を選ぶ画面まで） | 7.8 | 7.6 | 8.9 |
| PDF保存（同上） | 8.7 | 8.7 | 8.7 |
| 復元（復元した編み図の名前が出るまで） | 2.0 | 4.0 | 6.1 |

Swift側の各区間の所要時間（ms）は、DEBUGビルドが書く区間ファイルから取った。書き出しは1回の測定で3回（`.knit`、PNG（約19.25 MB）、PDF（約14.59 MB））あり、合計と最大を書く。

| 区間 | 内容 | small | medium | large |
|---|---|---:|---:|---:|
| `BridgeBackupRead` | 選んだバックアップのmapped read | 0.6 | 0.5 | 0.5 |
| `BridgeBackupEncode` | Webへ渡すBase64とJSON | 31.7 | 75.0 | 129.5 |
| `BridgeBackupJavaScript` | `evaluateJavaScript`の完了まで | 33.5 | 71.2 | 148.2 |
| `BridgeExportDecode` | Base64の復号とサイズの確認（3回の合計、括弧内は最大） | 28.8（14.6） | 36.3（14.3） | 41.5（19.1） |
| `BridgeExportWrite` | 一時ファイルのatomic write（同上） | 14.7（6.7） | 16.7（6.6） | 23.4（11.7） |

`BridgeBackupJavaScript`で渡したスクリプトは、small 5474733 bytes、medium 21894135 bytes、large 43786156 bytes。

ピークメモリ（物理フットプリント、MiB）は次のとおり。WebKitのプロセスは`responsible-process`がlaunchdなので、アプリの直後に起動したものを、PIDが隣り合うことからこのアプリのものとした。

| プロセス | small | medium | large |
|---|---:|---:|---:|
| アプリ本体 | 74.0 | 134.4 | 238.0 |
| WebKitコンテンツ | 615.3 | 812.4 | 720.8 |
| WebKit GPU | 201.9 | 201.8 | 201.3 |

- Hangs：アプリ本体のpotential hang（100 ms以上）は、smallで1件（161 ms）、mediumで0件、largeで4件（119〜162 ms）だった。UIテストの実行プロセス自身のものは数えていない。
- 端末のクラッシュ記録に、測定中のアプリとWebKitのものは無かった。この日のJetsamEvent（メモリ不足による強制終了の記録）は、どれも測定より前（最後は18:31）のものだった。

通常の復元で受け付ける最大のバックアップでも、Swift側の変換とファイル入出力の各区間がメインスレッドを止めた時間は最大約0.15秒（largeの`BridgeBackupJavaScript`、148.2 ms）で、iPhone 17では0.15秒を超える区間は無かった。メモリのピークでも警告や強制終了は起きなかった。処理をMainActorの外へ移すか、復号の前に大きさを確かめるかの判断は、3台の結果をまとめた最後の節に書いた。

各サイズ1回だけの測定である。iPadの結果は次の節にある。TestFlightのビルドでの測定は未実施で、#26のこの部分は#25を待って残る。

## 2026-11-02 Swift側の変換とファイル入出力の測定（#26、iPad Air 第5世代 / iPadOS 27.2、有線）

iPhone 17と同じ手順で、small・medium・largeを1回ずつ測った。smallは`test/measure-native-bridge-io`ブランチの`2c1c148`、mediumとlargeはmainを取り込んだ`eecaa9d`を、有料のApple Developerのチームで署名したDebugビルドで入れた（Xcode 27.2（27B52））。

| サイズ | バックアップ（bytes） |
|---|---:|
| small | 3959898 |
| medium | 15837837 |
| large | 31674922 |

UIテストで測った所要時間（秒）は次のとおり。

| 測定 | small | medium | large |
|---|---:|---:|---:|
| バックアップの書き出し（保存先の選択が閉じるまで） | 22.0 | 21.7 | 23.1 |
| PNG保存（保存先を選ぶ画面まで） | 10.0 | 10.0 | 10.2 |
| PDF保存（同上） | 11.1 | 11.2 | 11.2 |
| 復元（復元した編み図の名前が出るまで） | 3.6 | 4.5 | 7.6 |

Swift側の各区間の所要時間（ms）は次のとおり。

| 区間 | small | medium | large |
|---|---:|---:|---:|
| `BridgeBackupRead` | 0.5 | 0.7 | 0.6 |
| `BridgeBackupEncode` | 22.3 | 98.2 | 177.4 |
| `BridgeBackupJavaScript` | 30.8 | 99.7 | 199.6 |
| `BridgeExportDecode`（3回の合計、括弧内は最大） | 31.3（14.4） | 36.9（12.6） | 52.6（28.5） |
| `BridgeExportWrite`（同上） | 28.6（16.2） | 43.7（18.8） | 41.6（20.1） |

`BridgeBackupJavaScript`で渡したスクリプトは、small 5474025 bytes、medium 21893768 bytes、large 43788885 bytes。

ピークメモリ（物理フットプリント、MiB）は次のとおり。WebKitのプロセスは、iPhone 17と同じくPIDが隣り合うことからこのアプリのものとした。

| プロセス | small | medium | large |
|---|---:|---:|---:|
| アプリ本体 | 73.1 | 133.3 | 237.3 |
| WebKitコンテンツ | 665.2 | 688.7 | 932.3 |
| WebKit GPU | 201.9 | 227.9 | 200.9 |

- Hangs：アプリ本体のpotential hang（100 ms以上）は、smallで0件、mediumで4件（111〜245 ms）、largeで3件（178〜220 ms）だった。
- 端末のクラッシュ記録に、アプリとWebKitのものは無かった。保存先がiCloud Driveになって復元で失敗した最初の計測の途中（20:02）に、JetsamEventが1件記録された。終了させられたのは待機中のほかのプロセスで、このアプリとそのWebKitのコンテンツプロセスは動いたままだった。やり直した計測の間には、JetsamEventは無かった。

largeでは、Swift側の変換とJavaScriptの完了までがそれぞれ約0.2秒で、iPhone 17（約0.13〜0.15秒）より長かった。アプリのHangsも最長245 msで、iPhone 17の最長162 msより長い。WebKitのコンテンツプロセスは最大932.3 MiBまで増えたが、警告や強制終了は起きなかった。

各サイズ1回だけの測定である。

## 2026-11-02 Swift側の変換とファイル入出力の測定（#26、iPhone 13 mini / iOS 27.2、有線）

古めの端末での止まる長さを見るため、iPhone 17・iPad Air 第5世代と同じ手順で、small・medium・largeを1回ずつ測った。`test/measure-native-bridge-io`ブランチの`87179f2`を、有料のApple Developerのチームで署名したDebugビルドで入れた（Xcode 27.2（27B52））。

UIテストで測った所要時間（秒）は次のとおり。

| 測定 | small | medium | large |
|---|---:|---:|---:|
| バックアップの書き出し（保存先の選択が閉じるまで） | 21.8 | 21.2 | 23.0 |
| PNG保存（保存先を選ぶ画面まで） | 8.9 | 9.0 | 9.0 |
| PDF保存（同上） | 11.1 | 11.0 | 10.9 |
| 復元（復元した編み図の名前が出るまで） | 2.1 | 5.3 | 8.4 |

Swift側の各区間の所要時間（ms）は次のとおり。

| 区間 | small | medium | large |
|---|---:|---:|---:|
| `BridgeBackupRead` | 1.1 | 0.5 | 0.6 |
| `BridgeBackupEncode` | 42.3 | 115.4 | 203.0 |
| `BridgeBackupJavaScript` | 39.3 | 131.8 | 239.6 |
| `BridgeExportDecode`（3回の合計、括弧内は最大） | 21.0（13.3） | 41.0（24.8） | 62.3（43.3） |
| `BridgeExportWrite`（同上） | 12.5（8.1） | 21.2（10.2） | 26.4（17.0） |

ピークメモリ（物理フットプリント、MiB）は次のとおり。

| プロセス | small | medium | large |
|---|---:|---:|---:|
| アプリ本体 | 34.7 | 50.5 | 71.2 |
| WebKitコンテンツ | 467.8 | 541.6 | 875.0 |
| WebKit GPU | 99.5 | 99.6 | 300.0 |

- Hangs：アプリ本体のpotential hang（100 ms以上）は、smallで4件（115〜223 ms）、mediumで5件（108〜203 ms）、largeで8件（106〜457 ms）だった。largeの457 msは計測用データを作った直後の起動中のもので、ブリッジの区間とは時刻が重ならない。復元の時刻には239 msのものが1件あり、`BridgeBackupJavaScript`（239.6 ms）とほぼ同じ長さだった。
- PNGの書き出しで`BridgeExportDecode`に届いたデータは、どのサイズでも163 bytesだった。iPhone 17とiPadでは約19.25 MB（7052×7028 px）で、iPhone 13 miniでは画像が正しく作られていないおそれがある。保存先を選ぶ画面までは進んだ。原因は別に調べる。
- 端末のクラッシュ記録に、アプリとWebKitのものは無かった。

largeでは、Swift側の変換が203 ms、JavaScriptの完了までが240 msで、3台の中でいちばん長かった。変換はメインスレッドで行う。JavaScriptの区間は完了の通知までを測っており、その間ずっとメインスレッドが止まるとは限らない。Hangsで見えた復元の時刻の止まりは239 msの1件で、Appleがハングとする250 msのすぐ手前だった。

各サイズ1回だけの測定である。

### 3台の結果からの判断（2026-11-02）

3台のうち最も古いiPhone 13 miniでも、通常の復元で受け付ける最大のバックアップ（約30.2 MiB）で、Swift側の各区間は最大約0.24秒（`BridgeBackupJavaScript`、239.6 ms）、復元の時刻のアプリのHangsは239 msの1件で、Appleがハングとする250 msを超えなかった。編み図1枚（約3.8 MiB）では、どの端末も0.05秒未満だった。

このため、処理をMainActorの外へ移す改修と、復号の前に大きさを確かめる改修は行わないと決めた。復号の前の確認は、Web側の圧縮後32 MiBの上限があり、ネイティブ側の128 MiBを超えるデータが通常の経路で届かないため、効果も小さい。ただしiPhone 13 miniでは基準との差が小さいので、Web側の上限を上げるときや、復元のデータの形を変えるときは、変換をメインスレッドの外へ移すことを先に検討し、この手順で測り直す。

## 2026-11-03 提出用アーカイブのアップロードと審査への提出

v1.0の提出用アーカイブを作ってApp Store Connectへアップロードし、提出情報を入力して審査に提出した（#27）。

| 項目 | 記録 |
|---|---|
| 実施日 | 2026-11-03 |
| 実施者 | K0mork |
| Git commit | `main`の`b0a7f26`（2026-11-04にタグ`ios-v1.0-build1`を付けた） |
| 提出前のCI | `CI and deploy Pages`のrun [`41554607495`](https://github.com/K0mork/knittingEditor/actions/runs/41554607495)（`ci-gate`、`deploy`、`smoke`が成功）、Full iOS validationのrun [`41557279662`](https://github.com/K0mork/knittingEditor/actions/runs/41557279662)（`ios_full`×2、`app_update`×2、`release_archive`が成功） |
| Xcode / macOS | Xcode 27.2 (27B52) / macOS 27.2 (26B123) |
| アーカイブ | Release、汎用のiOS実機向け、Automatic署名。`DTSDKName`は`iphoneos27.2`、`DTXcodeBuild`は`27B52`、`CFBundlePackageType`は`APPL` |
| アップロード | `xcodebuild -exportArchive`（`method`が`app-store-connect`、`destination`が`upload`、Automatic署名、`manageAppVersionAndBuildNumber`をオン）。登録されたのは版1.0のビルド1 |
| 提出 | 2026-11-03 11:14（JST）、手動公開。状態は「審査待ち」 |

- `ios/scripts/check-release-assets.sh`は、アーカイブ内の`.app`を渡して成功した。`.xcarchive`そのものを渡すと、同梱のWeb資産が見つからず失敗する。
- 提出前に、App Store Connectの登録画面を文書と照合した。名前、サブタイトル（オフラインを売りにしない方針で「iPhone・iPadで簡単に編み図を作成」に変えた）、カテゴリ、第三者のコンテンツの権利、年齢制限（4+）、App Privacy（データを収集しない）、プライバシーポリシーURL、サポートURL、配信地域（EU加盟国と中国本土を外した）、価格（無料）、プロモーションテキスト、概要、キーワード、著作権、審査メモ、手動公開を確かめた。審査の連絡先の値は`private/APP_STORE_CONNECT.md`にある。
- スクリーンショットは、iPhoneの欄に6.3インチ、iPadの欄に13インチ、iPhone Duoの欄に外側の各5枚を登録した（[`SCREENSHOTS.md`](SCREENSHOTS.md)）。
- 任意のヘッダと検索結果の画像は入れていない。利用者の判断で、質を上げてから次の版以降で入れる。
- アクセシビリティの表示は入力していない。実機で確かめてから入力する（[`APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「アクセシビリティの表示」）。
- 残り：審査と並行して、TestFlightで提出ビルドを実機で確かめる（[`RELEASE_RUNBOOK.md`](RELEASE_RUNBOOK.md)の手順8、M6、#25、#26）。承認されても、確認が終わるまで公開しない。

## 2026-11-03 TestFlightでの提出ビルドの確認（#25、#26）

審査と並行して、提出したビルドをTestFlightの内部テストで入れ、利用者が手で確かめた（[`RELEASE_RUNBOOK.md`](RELEASE_RUNBOOK.md)の手順8）。

| 項目 | 記録 |
|---|---|
| 実施日 | 2026-11-03 |
| 実施者 | K0mork |
| ビルド | TestFlightの版1.0のビルド1（`main`の`b0a7f26`。[提出の記録](#2026-11-03-提出用アーカイブのアップロードと審査への提出)と同じビルド）。両端末のTestFlightで1.0 (1)と表示されることを確かめた |
| 端末 | iPhone 17（iPhone18,3）、iPad Air 第5世代（iPad13,16）。OSの版は記録していない |
| 配布 | App Store Connectで内部テストグループを作り、ビルド1を入れて、両端末のTestFlightアプリから入れた |

結果は、どの項目もiPhone・iPadの両方で同じだった。

- 開発ビルドからTestFlight版へ置き換えても、端末内の編み図は残った。
- M0・M6（機内モード）：機内モードでアプリを終了し、ホーム画面のアイコンから起動できた。新しい編み図で29記号すべてを表示して置け、範囲選択とコピー・貼り付け、戻す・やり直しができた。終了して起動し直すと編み図が残っていた。PNG・PDF・`.knit`を端末内へ保存し、「バックアップから復元」とFilesアプリからの`.knit`で同じ編み図に戻せた。「使い方」を開いて編集画面へ戻れた。
- M2（#26）：1000×1000の盤面に記号を1つ置き、ホーム画面から戻ったあとも、終了して起動し直したあとも盤面と記号が残った。再起動後の表示と、PNG・PDFの保存先を選ぶ画面が出るまでの時間は、ストップウォッチで測れないほど短かった。PNGの「1セルの画素数」を60pxにすると上限超過の表示が出て「PNGを保存」が押せなくなり、2pxに戻すと元に戻った。落ちたり固まったりしなかった。
- M3：共有シートからMacへ`.knit`とPNGをAirDropで送ったあと編集画面へ戻れた。Macから受け取った`.knit`を開いて復元できた。保存のキャンセル後に編集画面へ戻れ、同じ名前への上書き保存ができた。不正形式（でたらめなデータ4KB、SHA-256 `debaa81c34338ec9ee982fd9921b97d4e06999ff7f923d8174c8abaad1b0b316`）と巨大解凍データ（約300KBで解凍後300MB、SHA-256 `6783796b2c2318dc2e9ae743dd550be0fce8939b7cf9d28ebf2647666019e702`）は、落ちずに理由が表示された。
- M3（オフラインのiCloud Drive）：端末にダウンロードされていないiCloud Driveの`.knit`を機内モードで開くと、落ちずに「バックアップを読み込めませんでした」とだけ表示された。iCloudからのダウンロードに通信が要ることは分からない。Swift側が「大きすぎる」以外の読み込みの失敗を区別していないためである。利用者の判断で、v1.0ではクラッシュしないことで合格とし、理由の分かる表示は[#387](https://github.com/K0mork/knittingEditor/issues/387)で扱う。
- M4・M6（画面）：アイコンと起動画面、iPhoneの縦横、iPadの全画面と幅を変えたウィンドウで、欠けや操作できないところは無く、登録したスクリーンショットと大きな食い違いは無かった。「拡大表示」と太字テキストで、ホーム画面の表示名「棒針編み図」は切れなかった。
- クラッシュとメモリ（#26）：App Store ConnectのTestFlightのクラッシュは0件だった。両端末の「解析データ」に、当日の`knittingEditor`と`JetsamEvent`の記録は無かった。

未実施：メモリの値は測っていない（開発ビルドの測定スクリプトはTestFlightのビルドを入れ直してしまうため）。読み込み直前にファイルを消す確認（M3）は開発ビルドとLLDBが要るので、このビルドでは行っていない。

## 2026-11-03 アクセシビリティの表示の確認

App Store Connectのアクセシビリティの表示（Accessibility Nutrition Labels）の回答を決めるため、Appleの各機能の判定基準を読み、提出ビルドと同じアプリで確かめた。回答は[`APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「アクセシビリティの表示」にある。

| 項目 | 記録 |
|---|---|
| 実施日 | 2026-11-03 |
| 実施者 | K0mork（実機）、Claude Code（Simulator） |
| アプリ | Simulator：`main`の`320d25a`をReleaseでビルド（アプリのコードは提出ビルドの`b0a7f26`と同じ。以降の変更は文書だけ）。実機：TestFlightの版1.0のビルド1 |
| Xcode / macOS | Xcode 27.2 (27B52) / macOS 27.2 |
| 端末 | Simulator：KE verify iPhone（iPhone 17）とKE verify iPad（iPad (A16)）、iOS 27.2。実機：iPhone 17、iPad Air 第5世代 |

Simulatorの確認は、利用者の判断で実機の代わりにした。画面を順に開いて写真を残す一時的なUIテストを`simctl ui`の外観・コントラスト・文字サイズを変えて流し、写真を見て判断した。開いた画面は、編集画面、記号を置いたあと、色・記号・盤面・ブロック・出力の各パネル、消すモード、範囲選択、編み図の一覧、新しい編み図のダイアログ、使い方のページ。UIテストはコミットしていない。

- ダークインターフェイス：外観をダークにして、両端末で、起動中の表示から使い方のページまで暗いままだった。盤面の既定の地は白で、盤面パネルで黒・グレーに変えられる。「コントラストを上げる」と組み合わせても読みにくい灰色の文字は無かった。
- 十分なコントラスト：「コントラストを上げる」をオンにして、ライト・ダークとも両端末で、文字・枠・選択中の表示が読めた。「太字テキスト」と「透明度を下げる」は、`simctl`で切り替えられないので確かめていない。
- さらに大きな文字：iPhoneはAX3とAX5、iPadはAX3とAX5で確かめた。AX3で両端末に、ヘッダーの「使い方」「編み図」が大きくならず切れかける、編み図名が切れて全体が読めない、使い方のページと範囲選択の「コピーして貼付」「解除」が大きくならない、という問題があった。iPhoneでは記号名が消えて「範囲」「線」が画面の外に出た。iPadでは記号パネルの名前が途中で切れた。AX5のiPhoneでは、盤面設定の段数の欄が「100(」のように切れ、パネルの見出しが1文字ずつ折り返された。「対応」と答えず、[#389](https://github.com/K0mork/knittingEditor/issues/389)で直す。
- 視差効果を減らす（実機）：オンにして、準備中の表示が消える動き、パネルの開閉、操作のヒントが消える動きが、止まるか穏やかになった。回転・奥行き・続く動きは無かった。両端末とも利用者が確かめた。
- 色以外でも区別（実機）：グレイスケールにして、選んでいる道具・記号・背景色・色と、選んだ範囲が分かった。両端末とも利用者が確かめた。

同日、利用者がApp Store Connectの「アプリのアクセシビリティ」に、iPhone・iPadともダークインターフェイス・カラー以外で区別・十分なコントラスト・視差効果を減らすを入力し、下書きとして保存された。公開できるのはアプリの版がリリースされたあとである。

未実施：白い画面が一瞬出ないかは、静止画で見ただけで、動いているところは見ていない。VoiceOverと音声コントロールは、盤面を操作できないため確かめ直していない（方針どおり「対応」と答えない）。

## 2026-11-03 読み込み直前のファイル削除の確認（M3）

[M3](REAL_DEVICE_RELEASE_CHECKLIST.md#m3-files共有外部バックアップ)で残っていた、`.knit`を読み込む直前にファイルが消えたときの確認。TestFlightのビルドにはデバッガをつなげないので、開発ビルドで行った。

| 項目 | 記録 |
|---|---|
| 実施日 | 2026-11-03 |
| 実施者 | Claude Code（ビルド、LLDB、画面の撮影）、K0mork（「使い方」と「バックアップから復元」のタップ） |
| アプリ | `main`の`ce40940`をDebugでビルドし、`devicectl`で入れた。提出ビルドの`b0a7f26`からアプリのコード（`ios/App`、`ios/Web`、`ios/project.yml`、`packages`）は変わっていない |
| Xcode | Xcode 27.2 (27B52)。`lldb`を`devicectl`で起動したアプリにつないだ |
| 端末 | iPhone 17（iOS 27.2）、iPad Air 第5世代（iPadOS 27.2）。どちらも有線 |
| 入力 | Files・共有の経路：3行3目で記号の無い`.knit`（134バイト、SHA-256 `bab74d159df968bc6e7d3ee2c71c486acb76856cb02cb06ba2a1d65ef01e79e8`）を、`devicectl device copy to`でアプリの`Documents/`に置き、そのURLを`devicectl device process launch --payload-url`で渡した。「バックアップから復元」の経路：利用者がアプリから「このiPhone内」「このiPad内」へ書き出した`.knit`を選んだ |

`WebViewModel.swift`の`Data(contentsOf: readingURL, ...)`と、`PickedBackupFile.swift`の`Data(contentsOf: url, ...)`にブレークポイントを置いた。止まるたびに、読もうとしているファイルを`FileManager.default.removeItem(at:)`で消し、`fileExists`が`false`になったことを確かめてから再開した。「バックアップから復元」で消したのは、ファイル選択画面がアプリの一時領域に作った写しで、利用者が選んだ元のファイルは残った。

| 経路 | iPhone 17 | iPad Air 第5世代 |
|---|---|---|
| 起動中にファイルを渡す | 落ちずに、編集画面に「バックアップを読み込めませんでした」 | 同じ |
| 「使い方」を表示中にファイルを渡す | 使い方のページでは何も出ず、「編集画面へ戻る」を押すとすぐ同じ表示が1回出た | 同じ |
| アプリを終了した状態でファイルを渡して起動する | 起動の途中で止まり、再開後に編集画面が出てから同じ表示 | 同じ |
| 「バックアップから復元」で選ぶ | 落ちずに同じ表示 | 同じ |

- 両端末とも、アプリは最後まで落ちず、LLDBにも例外は出なかった。
- 「バックアップから復元」の行には停止位置が2つでき、続けて2回止まった。2回目は、ファイルがもう無いことを確かめて再開した。
- iPadでは、「バックアップから復元」で止まっている間に盤面を触った分が、再開したときに描かれた。アプリが止まっていたためで、ふだんの使い方では起きない。
- チェックリストに書いていたブレークポイントの場所（`WebViewContainer.swift`）は、読み込みの処理が`WebViewModel.swift`と`PickedBackupFile.swift`へ移ったあとの古いものだったので、直した。

未実施：Filesアプリでファイルをタップして開く操作は、Macから画面を触れないので行っていない。ファイルのURLを渡す方法で、同じ`handleIncomingURL`から先の処理を通した。Filesからのタップで開けることは、同日TestFlightのビルドで確かめてある。

## 2026-11-05 審査の却下（ガイドライン5.2.5）とサブタイトルの変更

2026-11-03に提出したv1.0が、審査で却下された（#27）。

| 項目 | 記録 |
|---|---|
| 審査日 | 2026-11-05 |
| 審査端末 | iPad Air 11インチ（M3） |
| 審査した版 | 1.0 (1) |
| 条項 | 5.2.5 Legal - Intellectual Property |
| 指摘 | メタデータに、Appleの製品やサービスと紛らわしい語が含まれる。サブタイトルの「iPhone」「iPad」の使い方が不適切 |
| 求められたこと | Appleの製品やサービスと紛らわしい画像や語を、メタデータから取り除く |

- 指摘はサブタイトルだけで、アプリの動作や機能への指摘は無い。ビルドは作り直さない。
- サブタイトルを「iPhone・iPadで簡単に編み図を作成」から「編み図を簡単に作成・印刷」に変える（利用者が決定。[`APP_STORE_METADATA.md`](APP_STORE_METADATA.md#基本情報)）。
- プロモーションテキストと説明文の「iPhone・iPadで」は、対応端末を説明する書き方で、指摘されていないので変えない。
- 製品ページのヘッダと検索結果の画像は、v1.0に入れていない（[2026-11-03の記録](#2026-11-03-提出用アーカイブのアップロードと審査への提出)）。2026-11-05に、版1.0のヘッダと検索結果に何も入っていないことを、利用者がApp Store Connectで確かめた。見出しに「iPhoneとiPad」があるので、入れる前に見直す（[`SCREENSHOTS.md`](SCREENSHOTS.md#製品ページのヘッダと検索結果)）。
- 2026-11-05に、利用者がApp Store Connectの「App情報」のサブタイトルを「編み図を簡単に作成・印刷」に替えた。
- 2026-11-05 17:22（JST）に、利用者がビルド1のまま再提出した。審査への返信は送っていない（任意）。
- 利用者の報告により、2026-11-06にv1.0が承認され、公開された。ビルド1の後に`main`へ入った変更は、1.1として提出した（[2026-11-06の記録](#2026-11-06-v11のアーカイブ作成と提出)）。

## 2026-11-06 v1.1のアーカイブ作成と提出

v1.0の公開後、審査中に`main`へ入った変更をまとめたv1.1を提出した（[#427](https://github.com/K0mork/knittingEditor/pull/427)、#430、#431）。

| 項目 | 記録 |
|---|---|
| 実施日 | 2026-11-06 |
| 実施者 | Claude Code（アーカイブ、検査、アップロード）、K0mork（App Store Connectの入力、提出） |
| Git commit | `1fc015f`（`main`） |
| Xcode / SDK | Xcode 27.2 (27B52) / iphoneos27.2 |
| 版・ビルド | 1.1 (1) |
| アーカイブ | `~/Library/Developer/Xcode/Archives/2026-11-06/knittingEditor 1.1 1fc015f.xcarchive` |
| タグ | `ios-v1.1-build1`（`1fc015f`） |
| 提出 | 2026-11-06 22:23（JST）、手動公開 |
| 公開 | 2026-11-07（JST）、利用者の報告 |

- 提出元の`1fc015f`で、`CI and deploy Pages`のrun [42214015767](https://github.com/K0mork/knittingEditor/actions/runs/42214015767)（`ci-gate`・`deploy`・`smoke`）と、`Full iOS validation`のrun [42214015686](https://github.com/K0mork/knittingEditor/actions/runs/42214015686)（iPhone 17・iPad (A16)の全テスト、両端末のapp_update、release_archive）が成功した。
- Xcode 27.2（`27B52`）のReleaseでアーカイブを作り、`ios/scripts/check-release-assets.sh`が成功した。アーカイブのアプリは`CFBundleShortVersionString=1.1`、`CFBundleVersion=1`、`DTSDKName=iphoneos27.2`、`DTXcodeBuild=27B52`。
- `xcodebuild -exportArchive`でApple Distributionに再署名し、`Manage Version and Build Number`を有効にしてApp Store Connectへアップロードした。処理完了のメールを受け取り、1.1 (1)を選んで提出した。
- 審査メモは、見出しの記号を外して箇条書き・番号・空行を保った3,810文字の文面を貼った。転記範囲の検査は3,848/4,000文字で成功した。
- タグ`ios-v1.1-build1`を`1fc015f`に付けてpushした。
- 利用者の報告により、1.1 (1)は承認され、公開された。2026-11-10に、App Storeの検索APIが返す日本のストアの現在の版は`1.1`、その公開日時は2026-11-06 22:25:53 UTC（JST 2026-11-07 07:25）だった。
- 2026-11-10に、日本のApp Storeの製品ページで、版1.1、「アップデート」の文、無料、年齢制限4+、データの収集なしを確かめた（Claude Code、アプリ内ブラウザ）。
- 製品ページの「アクセシビリティ」には、デベロッパがまだ機能を示していないと出ていた。2026-11-03に下書き保存した回答は、まだ公開されていない（[`RELEASE_RUNBOOK.md`](RELEASE_RUNBOOK.md)の手順9）。
- 残り: アクセシビリティの表示の公開。App Storeから入れた1.1での主要フローの確認は、公開前のTestFlightでの1.1 (1)の確認と合わせて、結果を記録していない。
