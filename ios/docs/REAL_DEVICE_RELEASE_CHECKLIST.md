# 実機リリースゲート

M0、M2、M3、M4、M6で残っている実機・署名・TestFlight確認を、同じ手順と証跡で実施するためのチェックリストです。Simulatorの成功だけではこの表を完了にしません。実施した日ごとの環境と結果は[リリース確認の記録](RELEASE_VERIFICATION_RECORDS.md)に残し、ここにはチェック欄、手順、判定だけを置きます。

M0〜M6は、統合前の開発計画の段階の番号です（M0 基盤とオフライン起動、M1 Web資産の同梱、M2 保存・復元、M3 Files・共有、M4 画面・入力・アクセシビリティ、M5 自動試験とオフライン検査、M6 配布）。M1とM5は自動試験とCIで確かめるため、実機の節はありません。

コマンドはリポジトリのルートで実行します。

## 実施前の固定情報

| 項目 | 記録すること |
|---|---|
| 実施日 | 日本時間の日付 |
| 実施者 | 実施した人 |
| Git commit | 入れたビルドのコミット（ブランチならその旨） |
| Xcode / macOS | 版とビルド番号 |
| iPhone機種・iOS | 機種名（識別子）とOSの版 |
| iPad機種・iPadOS | 同上 |
| Apple Developer Team / Bundle ID | Teamの種類（Personal Teamか有料か）と`com.k0mork.knittingEditor`。Team IDは書かない |
| 署名方式・証明書 | Automaticかどうかと証明書・Provisioning Profileの種類 |

着手時（2026-09-21）の値は[リリース確認の記録](RELEASE_VERIFICATION_RECORDS.md#2026-09-21-着手時の環境)にある。

実機へインストールする前に、XcodeのSigning & CapabilitiesでTeam、Bundle ID、証明書、Provisioning Profileを確定し、`xcodebuild -showBuildSettings`の`DEVELOPMENT_TEAM`と`PRODUCT_BUNDLE_IDENTIFIER`を記録する。Teamや証明書をリポジトリへ保存しない。

実機作業の開始時は、`ios/scripts/check-device-readiness.sh`を実行する。署名Team、Bundle ID、ペアリング済み実機の接続状態を読み取り、未設定なら失敗する。個人Team IDをプロジェクトへ保存しない場合は、`KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX ios/scripts/check-device-readiness.sh`のように、そのターミナルでだけ環境変数を指定する。Team IDはApple DeveloperのMembership detailsまたは署名証明書から確認し、シェル設定やリポジトリへ書き込まない。現在の開発環境での失敗は実機ゲート未実施の証跡であり、Simulatorの結果で置き換えない。

### 接続状態の見方

出力の`transport`を必ず確認する。

| transport | 意味 | 使える作業 |
|---|---|---|
| `wired` | ケーブル接続 | すべて。機内モード試験もこれが必要 |
| `localNetwork` | Wi-Fiペアリング（無線デバッグ） | 通常のビルド・テストは可能。機内モードでは切れて到達できなくなる |

`xcrun devicectl device info ...`が応答したことを接続の根拠にしてはいけない。Wi-Fiペアリングでも成功し、さらに問い合わせ自体が`tunnelState`を`connected`へ変えるため、ケーブルの有無を判断できない。`xcrun xctrace list devices`の`Devices Offline`も、無線で到達できる端末を含むことがある。

機内モード試験のようにケーブルが必須の作業では、次のように実行して有線接続を強制する。

```sh
KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX KNITTING_EDITOR_REQUIRE_WIRED=1 ios/scripts/check-device-readiness.sh
```

## M0: オフライン起動とWeb API PoC

機内モードにするとWi-Fiペアリングの端末はMacから見えなくなる。**この節はケーブル接続で実施する**。有線であれば機内モード中もビルド・テスト・ログ取得を続けられるので、`KNITTING_EDITOR_REQUIRE_WIRED=1`で事前に確認してから始める。

**前提: 無料のPersonal Teamでは自動テストを機内モードで実行できない。** 2026-09-22にiPad Air 第5世代（iPadOS 27.0、有線接続）で確認した内容は次のとおり。

- **ホーム画面からの通常起動は機内モードでもできる。** 機内モード中にアプリを終了し、アイコンから起動できることを実機で確認した。利用者の使い方は機内モードで成立する。
- 一方、開発ツール経由の導入と起動は機内モードで失敗する。`xcodebuild test`は再インストールを伴うため`The application could not be launched because the Developer App Certificate is not trusted`となり、`devicectl device process launch`も`profile has not been explicitly trusted by the user`で拒否された。したがって**機内モードでの自動テストは実行できない**。
- 開発者証明書の信頼が外れた状態でオフライン起動を試みると復旧できない。ネットワークを復帰させ、設定から信頼し直すか再インストールするまで起動できなかった。機内モードを解除してもWi-Fiが自動で戻らないことがある。
- この節の自動化は、有料のApple Developer Programに加入するかTestFlight配布ビルドを使えるようになってから行う。

機内モードで実行するテストは用意済みで、既定ではスキップされる。加入後は端末を機内モードにし、有線接続で次を実行する。`navigator.onLine`がfalseであることを先に検査するため、機内モードでない状態で成功したことにはならない。

```sh
TEST_RUNNER_KNITTING_EDITOR_AIRPLANE_MODE=1 xcodebuild test \
  -project ios/knittingEditor.xcodeproj -scheme knittingEditor \
  -destination 'platform=iOS,id=<UDID>' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<TeamID> \
  -only-testing:knittingEditorTests/LocalWebSchemeHandlerTests/testAirplaneModeServesEditorWithoutNetwork
```

なお、オフライン要件そのものは別経路で裏付けている。生成バンドルの静的検査（外部URL・CDN・分析の不在、CIで毎回実行）、実機WebKitでの`fetch`／`XHR`／`WebSocket`／`EventSource`未使用の実測、Swift側に通信コードが無いこと。利用者による機内モードの主要フロー（2026-09-22）と通信監視（2026-10-02）は[リリース確認の記録](RELEASE_VERIFICATION_RECORDS.md)のとおり確認済みである。開発ツール経由の機内モード自動テストと、TestFlight提出ビルドでの再確認は残っている。

- [x] 機内モードを有効にしてアプリを新規起動できる。（2026-09-22、iPad Air 第5世代。機内モード中にアプリを終了し、ホーム画面のアイコンから起動できることを確認）
- [x] 新規編み図を作成し、全記号、Canvas描画、Blob生成、PNG保存、PDF保存を完了できる。（2026-09-22、iPad Air 第5世代。当時のカタログv3の26記号を、利用者が機内モード中に記号メニューで全種の表示を目視確認。その後に足した3記号を含むv4の29記号は、提出ビルドの機内モード確認（M6）で通す）
- [x] `.knit`バックアップの圧縮・保存・復元を完了できる。
- [x] Worker、Pointer Events、IndexedDBが機内モードでエラーなく動く。
- [x] `設定 > 機内モード`の前後で、Safariや外部ホストへの要求が発生しない。（2026-10-02、iPad Air 第5世代。機内モードの前・中・後の操作を有線で通信監視し、アプリとWebKitのプロセスからの通信が無いことを確認。手順は下の「機内モード前後の通信監視の手順」）

証跡: 端末名、機内モード状態、操作動画または画面収録、保存したPNG/PDF/`.knit`のファイル名、失敗時のコンソールログ。

### 機内モード前後の通信監視の手順

端末の通信をMacで記録しながら、オンライン・機内モード・機内モード解除後の順に、起動・新規作成・記号の配置・PNG／PDF／`.knit`の端末内保存・「使い方」の往復を行う。判定は、`knittingEditor`と`com.apple.WebKit.*`のプロセスに通信が無いことで行う。

記録の方法は次のとおり。`rvictl`と`tcpdump`は管理者権限が必要なので、利用者のターミナルで実行する。`-k NP`で、パケットごとに送受信したプロセス名とPIDが付く（`PKTAP`）。

```sh
sudo /Library/Apple/usr/bin/rvictl -s <UDID>
sudo tcpdump -i rvi0 -n -l -k NP | tee <記録ファイル>
# 終わったら Ctrl+C、そのあと
sudo /Library/Apple/usr/bin/rvictl -x <UDID>
```

記録ファイルには端末のMACアドレスやローカルネットワークのIPアドレスが含まれるので、リポジトリには入れない。結果は[2026-10-02の記録](RELEASE_VERIFICATION_RECORDS.md#2026-10-02-機内モード前後の通信監視ipad-air-第5世代--ipados-270有線)。

## M2: 保存・復元・大規模盤面

1000×1000盤面の測定は、UIテスト`testLargeBoardSavesAndRestores`と測定用スクリプトで自動化してある。テストは新しい編み図を作り、「盤面」パネルの段数・列数で1000×1000にして記号を1つ置く。そのあと、保存の完了、バックグラウンドへ移して戻ったあとの盤面、アプリを終了して起動し直したあとの復元、PNGとPDFの出力が保存先を選ぶ画面に届くまでを順に確かめ、それぞれの所要時間を出す。スクリプトは、テストを流している間にInstrumentsのActivity Monitorで端末の全プロセスを記録し、アプリ本体とWebKitの各プロセスの最大メモリ（物理フットプリント）を表示する。盤面データ（`Uint32Array`と`Int32Array`で各約4MB）はアプリ本体ではなくWebKitのコンテンツプロセスにあるため、アプリ本体の値だけではピークメモリにならない。

```sh
KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX ios/scripts/measure-large-board.sh <UDID>
```

- 端末では「設定 > デベロッパ > UIオートメーションを有効にする」をオンにし、開発元を信頼しておく。測定中は画面をロックしない。
- 記録の保存に数分かかる。テストの結果は先に表示される。
- 無料Personal Teamでは機内モードでXCUITestを起動できない（M0）ため、測定はオンラインで行う。アプリが通信しないことはM0で確かめてある。

| 測定 | 目標・判定 |
|---|---|
| 盤面変更（段数・列数の入力から1000×1000の表示まで） | 失敗・ハングなし |
| 記号配置の反映 | 失敗・ハングなし |
| 保存時間 | 失敗・ハングなし、実測値を記録 |
| バックグラウンドからの復帰 | 盤面と記号が残る |
| 復元時間（再起動から1000×1000と記号の表示まで） | 失敗・ハングなし、実測値を記録 |
| PNG出力（保存先を選ぶ画面まで） | エラーなく完了 |
| PDF出力（同上） | エラーなく完了 |
| ピークメモリ（WebKitコンテンツプロセス） | 警告・強制終了なし、実測値を記録 |
| ピークメモリ（アプリ本体） | 同上 |

実測値は[リリース確認の記録](RELEASE_VERIFICATION_RECORDS.md#2026-10-022026-10-06-10001000盤面の測定m2)にある。測定のたびに、記録日・回数・端末を添えて足す。

1000×1000は盤面の最大の大きさで、PNGは既定のセルの大きさを縮めて上限（一辺16,384px、6,400万画素）に収めるため、この測定では上限超過のエラーにならない。上限の判定は`packages/editor-core/export/exporters.test.ts`で確かめてある。上限を超えたときのエラー表示の実機確認は#24で扱う。iPhone 17（iOS 27.0）では2026-10-09に、iPad Air 第5世代（iPadOS 27.0.1）では2026-10-15に確かめた（[2026-10-09](RELEASE_VERIFICATION_RECORDS.md#2026-10-09-実機確認記録iphone-17--ios-270有線)と[2026-10-15](RELEASE_VERIFICATION_RECORDS.md#2026-10-15-実機確認記録ipad-air-第5世代--ipados-2701有線)の記録）。表示はUIテスト`testOversizedPngExplainsLimitAndDisablesSave`で確かめる。

## M3: Files・共有・外部バックアップ

- [x] アプリからPNG、PDF、`.knit`をFilesへ保存する。（2026-09-22、iPad Air 第5世代。機内モードで3種すべてを「このiPad内」へ保存）
- [x] 共有シートからAirDropまたは別の共有先へ送る。（2026-09-22、iPad Air 第5世代。`.knit`とPNGを共有シートから送り、編集画面へ復帰することを確認）
- [x] Files、AirDrop、メール等から`.knit`をアプリで開き、同じ編み図へ復元する。（2026-09-22、iPad Air 第5世代。Filesから開く`onOpenURL`経路で復元し、13:09:56と13:10:28に編み図が作成されたことを端末内IndexedDBで実測。アプリ内「バックアップから復元」のDocument Picker経路も別途成立）
- [ ] キャンセル、上書き、存在しないファイル、不正形式、巨大解凍データでアプリがクラッシュしない。（保存シートのキャンセルはiPhone・iPad実機とSimulatorで自動検証済み。2026-10-09にiPhone 17で、上書き保存、不正形式（でたらめなデータの`.knit`）、巨大解凍データ（解凍後300MBの`.knit`）を確かめ、どれもクラッシュせずに理由が表示された。不正形式の理由が英語だったので日本語にした（PR #147）。欠損ファイルは下記の単体テストで例外処理とエラー配送を検証する。iPhone・iPadでの読み込み直前の削除とオフラインのiCloud Driveの確認は未完了であり、下記の手順で確かめる）
- [x] iPhoneとiPadの双方で同じ往復を行う。（iPadは2026-09-22に保存・共有・両方の取り込み経路が成立。iPhone 17は2026-10-09に、PNG・PDF・`.knit`を「このiPhone内」へ保存し、Filesの`.knit`から復元、MacからAirDropで受け取った`.knit`の復元、共有シートからMacへのAirDropの送信を確かめた）

欠損ファイルの自動テスト範囲（`ios/Tests/KnittingEditorAppTests/NativeErrorDeliveryTests.swift`）。WebViewへ送るスクリプトを記録し、イベント名とJSON化したメッセージを検証する。実機のFiles・共有やトーストの目視確認は含まない。

- `testMissingIncomingBackupThrows`／`testDeletedIncomingBackupThrows`: 作っていないファイルと作成後に削除したファイルを`readIncomingBackup(at:)`へ渡すと例外になる。
- `testMissingIncomingBackupErrorWaitsForWebViewAndReady`／`testMissingIncomingBackupErrorWaitsForReady`／`testMissingIncomingBackupErrorIsDeliveredImmediatelyWhenReady`: Files・共有から開く`handleIncomingURL`経路で欠損を捕まえ、「バックアップを読み込めませんでした」を通知する。WebView接続前・起動直後は編集画面の準備後、準備済みなら直ちに一度だけ配送し、使い方ページから戻っても再送しない。
- `testIncomingBackupErrorDuringGuideWaitsForEditorReady`: 使い方ページ表示中の読み込みエラーも、編集画面が再び`webReady`を送ってから一度だけ配送する。
- `testMissingPickerBackupReportsErrorAndClearsPresentationState`: Document Picker経路で欠損を捕まえて同じエラーを通知し、選択画面の状態を解除する。

実機で残る確認は、以下をiPhone・iPadの両方で行う。

1. 開発ビルドをLLDBでデバッグし、読み込み直前で止め、テスト用の`.knit`を削除してから再開する。停止場所は`WebViewModel.readIncomingBackup(at:)`の`Data(contentsOf: readingURL, ...)`と、`Coordinator.importBackup(from:)`の`Data(contentsOf: url, ...)`である。行番号ではなく、例えば以下のソースパターンでブレークポイントを置く。

   ```lldb
   breakpoint set --file WebViewContainer.swift --source-pattern-regexp 'Data\(contentsOf'
   ```

   Files・共有からの経路で停止したら、テスト用ファイルだけを次で削除して再開する。

   ```lldb
   expr -l swift -- try? FileManager.default.removeItem(at: readingURL)
   continue
   ```

   Document Picker経路では削除する変数を`url`に替える。Filesからは、アプリを終了した状態から開く場合（Xcodeのスキームで「Wait for the executable to be launched」を使う）と、起動中に開く場合の両方を確認する。使い方ページ表示中からも開き、編集画面へ戻る。期待結果は、クラッシュせず、準備後の編集画面に「バックアップを読み込めませんでした」が表示されることである。

2. iCloud Driveの端末へダウンロードされていない`.knit`を、機内モード（オフライン）でFilesから開く経路と、アプリの「バックアップから復元」で選ぶ経路で確認する。期待結果は、クラッシュせず、理由が表示されることである。Picker側で選べない・ダウンロードできない表示になる場合は、その表示を記録する。

証跡: 入力ファイルのSHA-256、出力ファイルのSHA-256、復元後の行数・目数・記号数、Filesの保存場所、共有先、キャンセル後に編集画面へ戻ったこと。

## M4: 画面・入力・アクセシビリティ

- [x] iPhone狭幅の縦／横、キーボード表示中、Safe Area端でヘッダー・ツールバー・ダイアログが欠けない。（2026-10-09、iPhone 17 / iOS 27.0。`testPrimaryControlsRemainUsableInPortraitAndLandscape`、`testDocumentDialogRemainsUsableAfterFocusingInput`、文字サイズ最大の3件が成功。横向きで左右のセーフエリアに黒い帯が出るのは見た目の問題として#146で扱う。帯の内側のヘッダー・ツールバー・ダイアログは欠けない）
- [x] iPad全画面、Split View、可変ウィンドウで編集盤面・保存パネルが操作できる。（2026-09-22、iPad Air 第5世代 / iPadOS 27.0。全画面954x1373・可変ウィンドウ584x861・Split View 681.5x954の3配置で`testManualWindowKeepsPrimaryFlowsUsable`が成功）
- [x] タッチ描画、2本指パン／ピンチ、マウス／トラックパッドを確認する。（2026-09-22、iPad Air 第5世代でタッチ描画・2本指パン・ピンチ・消去・範囲選択と貼り付けを確認。2本指ジェスチャで記号が入る不具合を発見し、修正後の動作も同端末で確認した。2026-10-09にiPhone 17でも、1本指のなぞり描き、2本指の移動・拡大で記号が入らないこと、消去、範囲選択とコピー・貼り付けを確かめた。2026-10-15に同じiPad（iPadOS 27.0.1）でトラックパッドを確かめた。クリック・ドラッグでの描画と消去、範囲選択と貼り付け、2本指スクロールでの移動、記号の一覧と出力パネルの操作はできたが、⌘＋スクロールとピンチでは拡大・縮小できなかった。WKWebViewがピンチをページへ渡さず、wheelに⌘が付かないためで、ネイティブでピンチを受けて盤面へ渡し、「表示」メニューに拡大（⌘+）・縮小（⌘−）を足した後、ピンチ・メニュー・⌘＋／⌘−での拡大縮小と、指のピンチ・描画が変わらないことを確かめた（#21、#80）。マウスは機材が無く未確認）
- [x] Apple Pencilで描画・選択・スクロールを確認する。（2026-09-22、iPad Air 第5世代。2026-10-15に、`main`の`ffb662d`と同じアプリ（iPadOS 27.0.1）で確かめ直した。ペンのタップで記号が1つ入り、なぞると続けて入る。手のひらを盤面に置いたままでも止まらず、拡大・移動に変わらない。1回なぞった分は「戻す」1回でまとめて消える。消去のタップ・なぞり、範囲のドラッグ、貼り付け位置の表示がペンについてくること、タップした位置への貼り付け、記号の一覧と出力パネルのスクロール、ボタンを押すことがペンでできる。ペンで描いたあとの指2本の移動・拡大では記号が入らない。7項目とも利用者が確かめた（#22））
- [x] VoiceOverで、道具・パネル・ダイアログのボタンの名前と状態が読み上げで分かる。（2026-10-09、iPhone 17 / iOS 27.0で`testCoreEditorControlsExposeAccessibleNamesAndState`が成功）
  - 2026-10-09に、この項目を見直した。以前は「見出し、記号選択、描画／消去／範囲、保存、ダイアログのラベル・状態・フォーカス順」をVoiceOverで手で確かめる項目だったが、盤面はVoiceOverで記号を置けない作り（1つのCanvas）で、VoiceOverだけでは編み図を作れない。App Storeのアクセシビリティの表示でも「VoiceOverに対応」とは答えない（[`APP_STORE_METADATA.md`](APP_STORE_METADATA.md)）。盤面以外のフォーカス順だけを整えても得られるものが小さいので、項目がアプリの作りに合っていなかったとして、v1.0では手動のフォーカス順の確認を外し、名前と状態の自動テストにした。盤面をVoiceOverで操作できるようにするときに、改めて確かめる。
- [x] Dynamic Type最大設定で主要操作44pt以上、文字の切れ・重なりがない。（iPhone 17とiPad Air 第5世代で文字の切れ・重なりが無いことを確認済み（#23）。2026-10-09にiPhone 17で文字サイズ最大の3件のUIテストを各3回流し、すべて成功した。44ptは、iOS版のCSSで操作の最小の大きさを44pxにしていること（`ios/Web/src/styles.css`の`--tap-size`など）で担保する）
- [ ] 「拡大表示」（設定 > 画面表示と明るさ > 画面表示を拡大）と太字テキストで、ホーム画面の表示名「棒針編み図」が切れないことを、iPhoneとiPadの実機で確かめる（[`APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「App名とホーム画面の表示名」。無料Personal Teamの開発ビルドでも確かめられる）。

証跡: 端末設定（表示サイズ、Dynamic Type、VoiceOver）、画面収録、問題のある画面のスクリーンショット、再現手順。

### 可変ウィンドウ・Split Viewの確認手順

XCUITestからウィンドウ分割は作れないため、端末側で配置してから次を実行する。向きを変えると配置が全画面へ戻るので、この実行では`setUp`が向きに触れないようにしてある。

```sh
TEST_RUNNER_KNITTING_EDITOR_MANUAL_WINDOW=1 xcodebuild test \
  -project ios/knittingEditor.xcodeproj -scheme knittingEditor \
  -destination 'platform=iOS,id=<UDID>' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<TeamID> \
  -only-testing:knittingEditorUITests/KnittingEditorUITests/testManualWindowKeepsPrimaryFlowsUsable
```

配置が失われた状態で実行すると、ウィンドウが画面と同じ大きさであることを検出して失敗する。全画面のまま成功したことにはならない。

## M6: TestFlight・App Store

- [ ] 署名済みArchiveを作成し、App Store ConnectへTestFlight内部配布する。
- [x] iPhone／iPadで機内モードの主要フローを実施する。（iPadは2026-09-22（M0）。iPhone 17は2026-10-09に、機内モードでアプリを起動し直し、新しい編み図を作って記号を置き、PNG・PDF・`.knit`を「このiPhone内」へ保存できた）
- [ ] TestFlightのクラッシュログ、メモリ警告、PNG/PDF出力時間を確認する。
- [ ] 提出ビルドで、AppIcon、起動画面、iPhone縦横、iPad全画面／可変幅の画面を確かめ、提出用の最終スクリーンショット（[`SCREENSHOTS.md`](SCREENSHOTS.md)、#290で用意済み）と食い違わないことを証跡に残す。
- [ ] App Privacy回答、Privacy Policy URL、サポートURL、審査メモを登録内容と照合する。
- [ ] [`docs/APP_STORE_CHECKLIST.md`](APP_STORE_CHECKLIST.md)の全項目を更新し、承認前に「配布完了」と報告しない。

証跡: Archiveのビルド番号、TestFlightテスター・実施端末、クラッシュ／メモリ結果、App Store Connectの各登録画面、最終スクリーンショット。

## 記録ルール

チェック欄には、根拠になった日付・端末と短い結果だけを書く。実施した日の環境（「実施前の固定情報」の項目）、結果、未実施項目は[リリース確認の記録](RELEASE_VERIFICATION_RECORDS.md)へ日付ごとの節で足し、同じ内容をその変更のPRの`docs/dev-log/`の記録にも書く（日付、commit、端末、結果、未実施項目、配布影響）。失敗は再現手順とログを残し、原因未確認のままskipや完了へ変更しない。
