# 実機リリースゲート

M0、M2、M3、M4、M6で残っている実機・署名・TestFlight確認を、同じ手順と証跡で実施するためのチェックリストです。Simulatorの成功だけではこの表を完了にしません。

## 実施前の固定情報

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

実機へインストールする前に、XcodeのSigning & CapabilitiesでTeam、Bundle ID、証明書、Provisioning Profileを確定し、`xcodebuild -showBuildSettings`の`DEVELOPMENT_TEAM`と`PRODUCT_BUNDLE_IDENTIFIER`を記録する。Teamや証明書をリポジトリへ保存しない。

実機作業の開始時は、`scripts/check-device-readiness.sh`を実行する。署名Team、Bundle ID、ペアリング済み実機の接続状態を読み取り、未設定なら失敗する。個人Team IDをプロジェクトへ保存しない場合は、`KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX scripts/check-device-readiness.sh`のように、そのターミナルでだけ環境変数を指定する。Team IDはApple DeveloperのMembership detailsまたは署名証明書から確認し、シェル設定やリポジトリへ書き込まない。現在の開発環境での失敗は実機ゲート未実施の証跡であり、Simulatorの結果で置き換えない。

### 接続状態の見方

出力の`transport`を必ず確認する。

| transport | 意味 | 使える作業 |
|---|---|---|
| `wired` | ケーブル接続 | すべて。機内モード試験もこれが必要 |
| `localNetwork` | Wi-Fiペアリング（無線デバッグ） | 通常のビルド・テストは可能。機内モードでは切れて到達できなくなる |

`xcrun devicectl device info ...`が応答したことを接続の根拠にしてはいけない。Wi-Fiペアリングでも成功し、さらに問い合わせ自体が`tunnelState`を`connected`へ変えるため、ケーブルの有無を判断できない。`xcrun xctrace list devices`の`Devices Offline`も、無線で到達できる端末を含むことがある。

機内モード試験のようにケーブルが必須の作業では、次のように実行して有線接続を強制する。

```sh
KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX KNITTING_EDITOR_REQUIRE_WIRED=1 scripts/check-device-readiness.sh
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
  -project knittingEditor.xcodeproj -scheme knittingEditor \
  -destination 'platform=iOS,id=<UDID>' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<TeamID> \
  -only-testing:knittingEditorTests/LocalWebSchemeHandlerTests/testAirplaneModeServesEditorWithoutNetwork
```

なお、オフライン要件そのものは別経路で裏付けている。生成バンドルの静的検査（外部URL・CDN・分析の不在、CIで毎回実行）、実機WebKitでの`fetch`／`XHR`／`WebSocket`／`EventSource`未使用の実測、Swift側に通信コードが無いこと。未確認なのは「機内モードで利用者が実際に使える」という最終確認だけである。

- [x] 機内モードを有効にしてアプリを新規起動できる。（2026-09-22、iPad Air 第5世代。機内モード中にアプリを終了し、ホーム画面のアイコンから起動できることを確認）
- [x] 新規編み図を作成し、26記号、Canvas描画、Blob生成、PNG保存、PDF保存を完了できる。（2026-09-22、iPad Air 第5世代。26記号は利用者が機内モード中に記号メニューで全種の表示を目視確認）
- [x] `.knit`バックアップの圧縮・保存・復元を完了できる。
- [x] Worker、Pointer Events、IndexedDBが機内モードでエラーなく動く。
- [x] `設定 > 機内モード`の前後で、Safariや外部ホストへの要求が発生しない。（2026-10-02、iPad Air 第5世代。機内モードの前・中・後の操作を有線で通信監視し、アプリとWebKitのプロセスからの通信が無いことを確認。手順と結果は下の「機内モード前後の通信監視」）

証跡: 端末名、機内モード状態、操作動画または画面収録、保存したPNG/PDF/`.knit`のファイル名、失敗時のコンソールログ。

### 2026-09-22 機内モード実施記録（iPad Air 第5世代 / iPadOS 27.0、有線）

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

未了だった機内モード前後の通信監視は、2026-10-02に実施した（次の節）。

機内モードでの新規起動は、利用者が機内モード中にアプリを終了しホーム画面のアイコンから起動して確認済み。26記号の目視も利用者が機内モード中に確認した。記号メニューのスクロールは機内モード中に自動化できない（後述）が、26記号の定義とID、全記号のCanvas・PNG・PDF描画は自動テストでも担保している。

機内モード中はアプリへタップやスクロールを送れない。実機への入力注入はXCUITestしか手段がなく、XCUITestはアプリを再インストール・再起動するため、無料Personal Teamでは機内モードで起動できない。`devicectl`は画面取得・ファイル取得・プロセス確認などの観察系のみで入力系のサブコマンドを持たない。有料加入後は`testAirplaneModeServesEditorWithoutNetwork`で一連を自動化できる。

### 2026-10-02 機内モード前後の通信監視（iPad Air 第5世代 / iPadOS 27.0、有線）

`main`の`6ad2592`を無料Personal Teamで署名して入れ、端末の通信をMacで記録しながら、利用者が次の操作を行った。

- A（オンライン）: アプリを終了してホーム画面から起動し、新しい編み図「通信確認」を作って記号を置き、PNG・PDF・`.knit`を「このiPad内」へ保存し、「使い方」を開いて編集画面へ戻った。
- B（機内モード）: Aと同じ操作を「通信確認2」で行った。
- C（機内モード解除後）: Wi-Fiの接続を確かめ、アプリを起動し直して記号を1つ置いた。

記録の方法は次のとおり。`rvictl`と`tcpdump`は管理者権限が必要なので、利用者のターミナルで実行した。`-k NP`で、パケットごとに送受信したプロセス名とPIDが付く（`PKTAP`）。

```sh
sudo /Library/Apple/usr/bin/rvictl -s <UDID>
sudo tcpdump -i rvi0 -n -l -k NP | tee <記録ファイル>
# 終わったら Ctrl+C、そのあと
sudo /Library/Apple/usr/bin/rvictl -x <UDID>
```

結果:

- 記録は20:47:45から20:50:55まで。端末のIndexedDBを有線で読み出すと、「通信確認」の作成は20:48:24、「通信確認2」の作成は20:49:54（機内モード中で、通信がほぼ途絶えた区間）、最後の更新はCの20:50:50だった。A〜Cの操作はすべて記録の中にある。
- 送受信したプロセスは、`mDNSResponder`、`nsurlsessiond`、`cloudd`、`apsd`、`maild`など、iPadOSのシステムと他のアプリのものだけだった。`knittingEditor`と`com.apple.WebKit.*`の通信は1件も無く、DNSやiCloudプライベートリレーなどを経由した通信の元プロセス（`eproc`）にも、アプリは含まれていなかった。プロセスが付かないパケットは、DHCP、IPv6の近隣探索、Appleのネットワーク（17.0.0.0/8）への通信だけだった。
- 名前解決は暗号化されたDNSで行われていて、DNSの記録から問い合わせ先の名前はほとんど読めない。このため、判定はプロセス名を根拠にした。

記録ファイルには端末のMACアドレスやローカルネットワークのIPアドレスが含まれるので、リポジトリには入れていない。

## M2: 保存・復元・大規模盤面

1000×1000盤面の測定は、UIテスト`testLargeBoardSavesAndRestores`と測定用スクリプトで自動化してある。テストは新しい編み図を作り、「盤面」パネルの段数・列数で1000×1000にして記号を1つ置く。そのあと、保存の完了、バックグラウンドへ移して戻ったあとの盤面、アプリを終了して起動し直したあとの復元、PNGとPDFの出力が保存先を選ぶ画面に届くまでを順に確かめ、それぞれの所要時間を出す。スクリプトは、テストを流している間にInstrumentsのActivity Monitorで端末の全プロセスを記録し、アプリ本体とWebKitの各プロセスの最大メモリ（物理フットプリント）を表示する。盤面データ（`Uint32Array`と`Int32Array`で各約4MB）はアプリ本体ではなくWebKitのコンテンツプロセスにあるため、アプリ本体の値だけではピークメモリにならない。

```sh
KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX ios/scripts/measure-large-board.sh <UDID>
```

- 端末では「設定 > デベロッパ > UIオートメーションを有効にする」をオンにし、開発元を信頼しておく。測定中は画面をロックしない。
- 記録の保存に数分かかる。テストの結果は先に表示される。
- 無料Personal Teamでは機内モードでXCUITestを起動できない（M0）ため、測定はオンラインで行う。アプリが通信しないことはM0で確かめてある。

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

1000×1000は盤面の最大の大きさで、PNGは既定のセルの大きさを縮めて上限（一辺16,384px、6,400万画素）に収めるため、この測定では上限超過のエラーにならない。上限の判定は`packages/editor-core/export/exporters.test.ts`で確かめてある。上限を超えたときのエラー表示の実機確認は#24で扱う。iPhone 17（iOS 27.0）では2026-10-09に確かめた（下の「2026-10-09 実機確認記録」）。iPadは未確認。

2026-09-22の記録（iPhone 17、手で1000×1000にした盤面）: 保存1.1〜2.2秒、復元2.6〜2.7秒、20×20からのリサイズ1.8秒、記号配置の反映1.7秒。アプリ本体のフットプリント16.5 MiB／Resident 52 MiB。

## M3: Files・共有・外部バックアップ

- [x] アプリからPNG、PDF、`.knit`をFilesへ保存する。（2026-09-22、iPad Air 第5世代。機内モードで3種すべてを「このiPad内」へ保存）
- [x] 共有シートからAirDropまたは別の共有先へ送る。（2026-09-22、iPad Air 第5世代。`.knit`とPNGを共有シートから送り、編集画面へ復帰することを確認）
- [x] Files、AirDrop、メール等から`.knit`をアプリで開き、同じ編み図へ復元する。（2026-09-22、iPad Air 第5世代。Filesから開く`onOpenURL`経路で復元し、13:09:56と13:10:28に編み図が作成されたことを端末内IndexedDBで実測。アプリ内「復元」のDocument Picker経路も別途成立）
- [ ] キャンセル、上書き、存在しないファイル、不正形式、巨大解凍データでアプリがクラッシュしない。（保存シートのキャンセルはiPhone・iPad実機とSimulatorで自動検証済み。2026-10-09にiPhone 17で、上書き保存、不正形式（でたらめなデータの`.knit`）、巨大解凍データ（解凍後300MBの`.knit`）を確かめ、どれもクラッシュせずに理由が表示された。不正形式の理由が英語だったので日本語にした（PR #147）。存在しないファイルは、再現する手順が無く未確認）
- [x] iPhoneとiPadの双方で同じ往復を行う。（iPadは2026-09-22に保存・共有・両方の取り込み経路が成立。iPhone 17は2026-10-09に、PNG・PDF・`.knit`を「このiPhone内」へ保存し、Filesの`.knit`から復元、MacからAirDropで受け取った`.knit`の復元、共有シートからMacへのAirDropの送信を確かめた）

証跡: 入力ファイルのSHA-256、出力ファイルのSHA-256、復元後の行数・目数・記号数、Filesの保存場所、共有先、キャンセル後に編集画面へ戻ったこと。

## M4: 画面・入力・アクセシビリティ

- [x] iPhone狭幅の縦／横、キーボード表示中、Safe Area端でヘッダー・ツールバー・ダイアログが欠けない。（2026-10-09、iPhone 17 / iOS 27.0。`testPrimaryControlsRemainUsableInPortraitAndLandscape`、`testDocumentDialogRemainsUsableAfterFocusingInput`、文字サイズ最大の3件が成功。横向きで左右のセーフエリアに黒い帯が出るのは見た目の問題として#146で扱う。帯の内側のヘッダー・ツールバー・ダイアログは欠けない）
- [x] iPad全画面、Split View、可変ウィンドウで編集盤面・保存パネルが操作できる。（2026-09-22、iPad Air 第5世代 / iPadOS 27.0。全画面954x1373・可変ウィンドウ584x861・Split View 681.5x954の3配置で`testManualWindowKeepsPrimaryFlowsUsable`が成功）
- [ ] タッチ描画、2本指パン／ピンチ、マウス／トラックパッドを確認する。（2026-09-22、iPad Air 第5世代でタッチ描画・2本指パン・ピンチ・消去・範囲選択と貼り付けを確認。2本指ジェスチャで記号が入る不具合を発見し、修正後の動作も同端末で確認した。マウス／トラックパッドは機材が無く未実施。2026-10-09にiPhone 17でも、1本指のなぞり描き、2本指の移動・拡大で記号が入らないこと、消去、範囲選択とコピー・貼り付けを確かめた）
- [x] Apple Pencilで描画・選択・スクロールを確認する。（2026-09-22、iPad Air 第5世代）
- [x] VoiceOverで、道具・パネル・ダイアログのボタンの名前と状態が読み上げで分かる。（2026-10-09、iPhone 17 / iOS 27.0で`testCoreEditorControlsExposeAccessibleNamesAndState`が成功）
  - 2026-10-09に、この項目を見直した。以前は「見出し、記号選択、描画／消去／範囲、保存、ダイアログのラベル・状態・フォーカス順」をVoiceOverで手で確かめる項目だったが、盤面はVoiceOverで記号を置けない作り（1つのCanvas）で、VoiceOverだけでは編み図を作れない。App Storeのアクセシビリティの表示でも「VoiceOverに対応」とは答えない（`APP_STORE_METADATA.md`）。盤面以外のフォーカス順だけを整えても得られるものが小さいので、項目がアプリの作りに合っていなかったとして、v1.0では手動のフォーカス順の確認を外し、名前と状態の自動テストにした。盤面をVoiceOverで操作できるようにするときに、改めて確かめる。
- [x] Dynamic Type最大設定で主要操作44pt以上、文字の切れ・重なりがない。（iPhone 17とiPad Air 第5世代で文字の切れ・重なりが無いことを確認済み（#23）。2026-10-09にiPhone 17で文字サイズ最大の3件のUIテストを各3回流し、すべて成功した。44ptは、iOS版のCSSで操作の最小の大きさを44pxにしていること（`ios/Web/src/styles.css`の`--tap-size`など）で担保する）

証跡: 端末設定（表示サイズ、Dynamic Type、VoiceOver）、画面収録、問題のある画面のスクリーンショット、再現手順。

## M6: TestFlight・App Store

- [ ] 署名済みArchiveを作成し、App Store ConnectへTestFlight内部配布する。
- [x] iPhone／iPadで機内モードの主要フローを実施する。（iPadは2026-09-22（M0）。iPhone 17は2026-10-09に、機内モードでアプリを起動し直し、新しい編み図を作って記号を置き、PNG・PDF・`.knit`を「このiPhone内」へ保存できた）
- [ ] TestFlightのクラッシュログ、メモリ警告、PNG/PDF出力時間を確認する。
- [ ] AppIcon、起動画面、iPhone縦横、iPad全画面／可変幅の最終スクリーンショットを撮影する。
- [ ] App Privacy回答、Privacy Policy URL、サポートURL、審査メモを登録内容と照合する。
- [ ] `docs/APP_STORE_CHECKLIST.md`の全項目を更新し、承認前に「配布完了」と報告しない。

証跡: Archiveのビルド番号、TestFlightテスター・実施端末、クラッシュ／メモリ結果、App Store Connectの各登録画面、最終スクリーンショット。

## 2026-09-21 実機実行記録（iPhone 17 / iOS 27.0）

上のチェック欄は、目視・機内モード・計測を伴う項目が残っているため未完了のままとする。この日に実機で確認できた内容だけを記録する。

実施できたこと。

- 署名ビルド、インストール、起動。`scripts/check-device-readiness.sh`が`Device release preflight is ready.`で通過。
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

- デベロッパモードを有効化し、署名ビルド・インストール・起動を確認した。`scripts/check-device-readiness.sh`はiPhoneとiPadの両方をオンライン端末として検出する。
- Swift単体テスト22件成功、XCUITest 11件成功（2件はアプリ更新プローブのためスキップ、206.5秒）。
- iPadで発見して直したもの。
  - 書き出しの保存シートは、iPadでは「×」が`label`の`Cancel`ボタンとして押せる（`frame=(14, 46, 36x36)`、`isHittable=true`）。iPhone向けに実装した下スワイプはiPadでは閉じられなかったため、押せる場合はボタンを使い、押せない場合だけスワイプへ落とすようにした。
  - ダイアログ入力で先頭文字を取りこぼしていた。`M2切替A`が`2切替A`になり、さらに初期値「新しい編み図」が消えずに残って`2切替A新しい編み図`という名前になっていた。キーボード表示を待ってから初期値を消して入力し、入力結果を検査するようにした。アプリ側も`window.prompt`と同じく初期値を選択状態にして開くようにした。
- 全画面（954x1373）、可変ウィンドウ（584x861）、Split View（681.5x954）のいずれでも、主要操作・各パネルの開閉・ダイアログ入力・盤面への描画が成立した。画面サイズは1373x954。`testManualWindowKeepsPrimaryFlowsUsable`として手順化してある。
- 未解決: iPad実機のフルスイートで`testBackupExportSheetDismissesBackToEditor`が断続的に失敗する（単独実行では毎回成功）。失敗時の診断情報と画面添付を入れてあるので、次に発生した結果bundleで切り分ける。
- 未実施: Apple Pencil、タッチ・ピンチ、VoiceOver、Files実保存とAirDrop、iPad版スクリーンショット。

### 可変ウィンドウ・Split Viewの確認手順

XCUITestからウィンドウ分割は作れないため、端末側で配置してから次を実行する。向きを変えると配置が全画面へ戻るので、この実行では`setUp`が向きに触れないようにしてある。

```sh
TEST_RUNNER_KNITTING_EDITOR_MANUAL_WINDOW=1 xcodebuild test \
  -project knittingEditor.xcodeproj -scheme knittingEditor \
  -destination 'platform=iOS,id=<UDID>' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<TeamID> \
  -only-testing:knittingEditorUITests/KnittingEditorUITests/testManualWindowKeepsPrimaryFlowsUsable
```

配置が失われた状態で実行すると、ウィンドウが画面と同じ大きさであることを検出して失敗する。全画面のまま成功したことにはならない。

## 2026-10-09 実機確認記録（iPhone 17 / iOS 27.0、有線）

`main`の`40959f5`（#143まで）を無料Personal Teamで署名して入れた。#147の確認は、そのPRのブランチを入れて行った。

- XCUITest：文字サイズ最大の3件（`testAccessibilityExtraExtraExtraLarge…`）を各3回、計9回流し、すべて成功した。iOS 27のSimulatorで起動が「編み図を準備しています」から進まない件（#64）は、実機では起きなかった。続けてUIテスト全体（CIと同じく`testBackupExportSheetDismissesBackToEditor`を除く）を流し、実行した17件がすべて成功した（iPad用・測定用など9件は既定どおりスキップ）。
- 起動の画面収録（ライト）：起動の動きの緑と、「編み図を準備しています…」が出てからの緑は同じ色で、途中で色が変わるコマは無かった。iOS 27のSimulatorで起動画面の緑が鮮やかに見えた件（#117）は、実機では起きなかった。準備中の表示のあとに「編み図を読み込んでいます…」の画面は出ず、約0.3秒で編集画面へ移った。
- MacからAirDropで`.knit`を送り、受信画面に種類名「棒針編み図バックアップ」が日本語で出ることを利用者が確かめた（#82）。
- 「設定 > アクセシビリティ > ズーム」をオンにし、3本指ダブルタップで拡大して、ヘッダーと道具の文字を読める大きさにできることを利用者が確かめた（#81）。
- 1000×1000の盤面で、PNGの1セルの画素数を最大にして保存しようとすると、クラッシュせずに「一辺が上限16384pxを超えます。PDF保存をおすすめします。」と出ることを利用者が確かめた（#24、PR #147の文言）。
- M3・M4・M6の各項目は上の各節に書いた。
- 使ったテスト用の`.knit`のSHA-256：相互運用fixture（`AirDrop確認.knit`）`a902b24a5c26ed0481b72e3060932afa164fe8920a3a6a698acc6a13f26991d5`、不正形式`bf390681bb3e243b57609aa0f2869cbec9d310ef14a8d40bf371587fd60529a6`、巨大解凍データ`55e0fe7b35fd3935b2b315a111fe338512ece9c7c286277eb0ac9261911b3814`。iPhoneから送った`.knit`（20段×20目、記号82個）`6339ed79df2a722ba62fedeb1f199ac3c2139f0f0ae9c455342df612f30db4bf`。

## 記録ルール

実施結果はこのファイルのチェック欄だけでなく、`docs/dev-log/`の記録に日付、commit、端末、結果、未実施項目、配布影響を書く。失敗は再現手順とログを残し、原因未確認のままskipや完了へ変更しない。
