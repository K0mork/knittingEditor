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
| Apple Developer Team / Bundle ID | 無料Personal Team / `com.k0mork.knittingEditor` |
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
- [ ] `設定 > 機内モード`の前後で、Safariや外部ホストへの要求が発生しない。（機内モード中の通信監視は未実施。静的検査と実機での通信API未使用の実測は別途済み）

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

未了は機内モード前後の通信監視のみ。

機内モードでの新規起動は、利用者が機内モード中にアプリを終了しホーム画面のアイコンから起動して確認済み。26記号の目視も利用者が機内モード中に確認した。記号メニューのスクロールは機内モード中に自動化できない（後述）が、26記号の定義とID、全記号のCanvas・PNG・PDF描画は自動テストでも担保している。

機内モード中はアプリへタップやスクロールを送れない。実機への入力注入はXCUITestしか手段がなく、XCUITestはアプリを再インストール・再起動するため、無料Personal Teamでは機内モードで起動できない。`devicectl`は画面取得・ファイル取得・プロセス確認などの観察系のみで入力系のサブコマンドを持たない。有料加入後は`testAirplaneModeServesEditorWithoutNetwork`で一連を自動化できる。

## M2: 保存・復元・大規模盤面

1. 機内モードの実機で1000×1000盤面を作成し、記号を配置する。
2. 編集直後、バックグラウンド移行直前、復帰直後、アプリ強制終了相当の再起動後に内容を確認する。
3. 保存・復元について、所要時間、ピークメモリ、復元後のセル数・記号数を記録する。
4. PNG出力上限、PDF出力時間、メモリ警告の有無を記録する。

| 測定 | 目標・判定 | iPhone | iPad |
|---|---|---|---|
| 保存時間 | 失敗・ハングなし、実測値を記録 |  |  |
| 復元時間 | 失敗・ハングなし、実測値を記録 |  |  |
| ピークメモリ | 警告・強制終了なし、実測値を記録 |  |  |
| PNG/PDF出力 | エラー表示が仕様どおり |  |  |

証跡: Instruments（AllocationsまたはActivity Monitor）の記録、画面収録、出力ファイル、端末ログ。測定値のない「問題なし」は完了扱いにしない。

## M3: Files・共有・外部バックアップ

- [x] アプリからPNG、PDF、`.knit`をFilesへ保存する。（2026-09-22、iPad Air 第5世代。機内モードで3種すべてを「このiPad内」へ保存）
- [x] 共有シートからAirDropまたは別の共有先へ送る。（2026-09-22、iPad Air 第5世代。`.knit`とPNGを共有シートから送り、編集画面へ復帰することを確認）
- [x] Files、AirDrop、メール等から`.knit`をアプリで開き、同じ編み図へ復元する。（2026-09-22、iPad Air 第5世代。Filesから開く`onOpenURL`経路で復元し、13:09:56と13:10:28に編み図が作成されたことを端末内IndexedDBで実測。アプリ内「復元」のDocument Picker経路も別途成立）
- [ ] キャンセル、上書き、存在しないファイル、不正形式、巨大解凍データでアプリがクラッシュしない。（保存シートのキャンセルはiPhone・iPad実機とSimulatorで自動検証済み。不正形式と巨大解凍データはWeb単体テストで検証済みだが実機未確認。上書きと存在しないファイルは未確認）
- [ ] iPhoneとiPadの双方で同じ往復を行う。（iPadは保存・共有・両方の取り込み経路が成立。iPhoneは`.knit`のFiles保存のみ実施し、PNG／PDFと復元が未実施）

証跡: 入力ファイルのSHA-256、出力ファイルのSHA-256、復元後の行数・目数・記号数、Filesの保存場所、共有先、キャンセル後に編集画面へ戻ったこと。

## M4: 画面・入力・アクセシビリティ

- [ ] iPhone狭幅の縦／横、キーボード表示中、Safe Area端でヘッダー・ツールバー・ダイアログが欠けない。
- [x] iPad全画面、Split View、可変ウィンドウで編集盤面・保存パネルが操作できる。（2026-09-22、iPad Air 第5世代 / iPadOS 27.0。全画面954x1373・可変ウィンドウ584x861・Split View 681.5x954の3配置で`testManualWindowKeepsPrimaryFlowsUsable`が成功）
- [ ] タッチ描画、2本指パン／ピンチ、マウス／トラックパッドを確認する。（2026-09-22、iPad Air 第5世代でタッチ描画・2本指パン・ピンチ・消去・範囲選択と貼り付けを確認。2本指ジェスチャで記号が入る不具合を発見し、修正後の動作も同端末で確認した。マウス／トラックパッドは機材が無く未実施）
- [x] Apple Pencilで描画・選択・スクロールを確認する。（2026-09-22、iPad Air 第5世代）
- [ ] VoiceOverで見出し、記号選択、描画／消去／範囲、保存、ダイアログのラベル・状態・フォーカス順を確認する。
- [ ] Dynamic Type最大設定で主要操作44pt以上、文字の切れ・重なりがない。

証跡: 端末設定（表示サイズ、Dynamic Type、VoiceOver）、画面収録、問題のある画面のスクリーンショット、再現手順。

## M6: TestFlight・App Store

- [ ] 署名済みArchiveを作成し、App Store ConnectへTestFlight内部配布する。
- [ ] iPhone／iPadで機内モードの主要フローを実施する。
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

## 記録ルール

実施結果はこのファイルのチェック欄だけでなく、`DEVELOPMENT_LOG.md`へ日付、commit、端末、結果、未実施項目、配布影響を追記する。失敗は再現手順とログを残し、原因未確認のままskipや完了へ変更しない。
