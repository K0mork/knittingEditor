# 実機リリースゲート

M0、M2、M3、M4、M6で残っている実機・署名・TestFlight確認を、同じ手順と証跡で実施するためのチェックリストです。Simulatorの成功だけではこの表を完了にしません。

## 実施前の固定情報

| 項目 | 記録 |
|---|---|
| 実施日 | YYYY-MM-DD |
| 実施者 |  |
| Git commit | `git rev-parse HEAD` |
| Xcode / macOS |  |
| iPhone機種・iOS |  |
| iPad機種・iPadOS |  |
| Apple Developer Team / Bundle ID | `com.k0mork.knittingEditor` |
| 署名方式・証明書 |  |

実機へインストールする前に、XcodeのSigning & CapabilitiesでTeam、Bundle ID、証明書、Provisioning Profileを確定し、`xcodebuild -showBuildSettings`の`DEVELOPMENT_TEAM`と`PRODUCT_BUNDLE_IDENTIFIER`を記録する。Teamや証明書をリポジトリへ保存しない。

実機作業の開始時は、`scripts/check-device-readiness.sh`を実行する。このスクリプトは署名Team、Bundle ID、Xcodeがオンラインと判定したiOS端末だけを読み取り、未設定なら失敗する。個人Team IDをプロジェクトへ保存しない場合は、`KNITTING_EDITOR_DEVELOPMENT_TEAM=XXXXXXXXXX scripts/check-device-readiness.sh`のように、そのターミナルでだけ環境変数を指定する。Team IDはApple DeveloperのMembership detailsまたは署名証明書から確認し、シェル設定やリポジトリへ書き込まない。現在の開発環境での失敗は実機ゲート未実施の証跡であり、Simulatorの結果で置き換えない。

## M0: オフライン起動とWeb API PoC

- [ ] 機内モードを有効にしてアプリを新規起動できる。
- [ ] 新規編み図を作成し、26記号、Canvas描画、Blob生成、PNG保存、PDF保存を完了できる。
- [ ] `.knit`バックアップの圧縮・保存・復元を完了できる。
- [ ] Worker、Pointer Events、IndexedDBが機内モードでエラーなく動く。
- [ ] `設定 > 機内モード`の前後で、Safariや外部ホストへの要求が発生しない。

証跡: 端末名、機内モード状態、操作動画または画面収録、保存したPNG/PDF/`.knit`のファイル名、失敗時のコンソールログ。

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

- [ ] アプリからPNG、PDF、`.knit`をFilesへ保存する。
- [ ] 共有シートからAirDropまたは別の共有先へ送る。
- [ ] Files、AirDrop、メール等から`.knit`をアプリで開き、同じ編み図へ復元する。
- [ ] キャンセル、上書き、存在しないファイル、不正形式、巨大解凍データでアプリがクラッシュしない。
- [ ] iPhoneとiPadの双方で同じ往復を行う。

証跡: 入力ファイルのSHA-256、出力ファイルのSHA-256、復元後の行数・目数・記号数、Filesの保存場所、共有先、キャンセル後に編集画面へ戻ったこと。

## M4: 画面・入力・アクセシビリティ

- [ ] iPhone狭幅の縦／横、キーボード表示中、Safe Area端でヘッダー・ツールバー・ダイアログが欠けない。
- [ ] iPad全画面、Split View、可変ウィンドウで編集盤面・保存パネルが操作できる。
- [ ] タッチ描画、2本指パン／ピンチ、マウス／トラックパッドを確認する。
- [ ] Apple Pencilで描画・選択・スクロールを確認する。
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

## 記録ルール

実施結果はこのファイルのチェック欄だけでなく、`DEVELOPMENT_LOG.md`へ日付、commit、端末、結果、未実施項目、配布影響を追記する。失敗は再現手順とログを残し、原因未確認のままskipや完了へ変更しない。
