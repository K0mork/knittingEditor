# App Store提出チェックリスト

提出・公開までの順序は、[v1.0 提出・公開の手順](RELEASE_RUNBOOK.md)を参照する。

## 実装・資産

- [x] Apple Developer Team、Bundle ID、署名証明書、Provisioning Profileを確定する。Teamは個人で加入したApple Developer Programのもの（方針は2026-10-02に決定）。署名はAutomaticを続ける。手順は[RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md)の手順2・3。（2026-11-02、加入が有効になり、有料のTeamのAutomatic署名で`com.k0mork.knittingEditor`のApple Development証明書とProvisioning Profileが解決し、iPhone・iPadへ入れて起動できた（#17、[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-02-有料teamでの署名と実機導入iphone-17--ios-272ipad-air-第5世代--ipados-272有線)）。提出用の配布証明書は、手順5でArchiveをアップロードするときにXcodeが作る）
- [x] AppIconのAny・Dark・Tintedを1024×1024で登録する（小サイズはXcodeが生成）。素材・再生成手順は`../design/app-icon/README.md`。
- [x] iPhone・iPadのホーム画面でライト・ダーク・色合いを切り替えて確認した（iOS 18.2）。小サイズは設定のアプリ一覧（iPhone、iOS 27.0）とSpotlight（iPhone・iPad、iOS 18.2）で確認した（#78、PR #94の比較画像）。
- [x] 起動画面を確認する。（2026-10-21、Xcode 27.1のReleaseビルドをiOS 27.0 Simulatorのライト・ダークで録画し、白や黒の全面表示が出ないことを確認。[記録](RELEASE_VERIFICATION_RECORDS.md#2026-10-21-起動画面の確認simulator)。提出ビルドでの最終確認は実機リリースゲートのM6で行う）
- [x] iPhone 6.9インチ（1320×2868）とiPad 13インチ（2064×2752）の、説明文入りの最終スクリーンショットを各5枚、`docs/screenshots/app-store-*.png`へ保存する（2026-10-20、#290。画面・順・文面は[`SCREENSHOTS.md`](SCREENSHOTS.md)）。App Store ConnectのiPhoneの欄はmedium display（1179×2556または1206×2622）の大きさしか受け付けないので、6.9インチから縮小した6.3インチ（1206×2622）の5枚も保存する（2026-11-03、#353）。
- [x] iPhone Duoの外側（1398×2034）と内側（2007×2853）の、説明文入りのスクリーンショットを各5枚、同じ画面・順・文面で保存する（2026-10-29、#353。[`SCREENSHOTS.md`](SCREENSHOTS.md#iphone-duo)）。2027年4月から、iOS 27.1 SDK以降でビルドしたアプリの提出に必要になる。App Store Connectの欄は外側・内側のどちらも受け付けるので、片方の5枚を登録する（2026-11-03に確かめた）。
- [x] 製品ページのヘッダと検索結果に使う共通の画像（5244×2950、透過なし）を保存する（2026-11-03。[`SCREENSHOTS.md`](SCREENSHOTS.md#製品ページのヘッダと検索結果)）。任意の項目。
- [ ] iPhone／iPadの実機スクリーンショットを撮影する（任意。提出要件はSimulator素材で満たしている）。
- [x] iPhone 16／iPad (10th generation) Simulatorのスクリーンショット下書きを`docs/screenshots/`へ保存する。
- [x] iPhone 16／iPad (10th generation) Simulatorの起動画面下書きを`docs/screenshots/`へ保存する（最終素材ではない）。
- [x] `App/PrivacyInfo.xcprivacy`を同梱し、収集データなし・トラッキングなしと一致させる。使っている理由の申告が必要なAPI（`UserDefaults`、理由`CA92.1`）を申告し、`scripts/check-app-bundle.sh`で申告漏れを検査する。
- [x] アプリ内ヘルプへプライバシーとサポート導線を同梱する。
- [x] 公開Privacy Policy本文をリポジトリルートの`public/privacy/app/index.html`へ用意する（公開URL: https://knittingeditor.com/privacy/app/、登録は#27）。
- [x] App Review 4.2向けのネイティブ統合説明を[`docs/APP_REVIEW_NOTES.md`](APP_REVIEW_NOTES.md)へ記録する。
- [x] App Store提出メタデータの下書きを[`docs/APP_STORE_METADATA.md`](APP_STORE_METADATA.md)へ用意する。
- [x] 輸出コンプライアンスのため、`App/Info.plist`へ`ITSAppUsesNonExemptEncryption`を`false`で入れる。
- [x] 同梱する第三者ソフトウェアのライセンス表記を、アプリ内の「使い方」から開ける`/third-party-notices/`へ置く。
- [x] アカウント無しで非公開に連絡できるサポート窓口とサポートURLを用意する（#75）。窓口は`support@knittingeditor.com`、サポートURLは`https://knittingeditor.com/support/`。
- [x] App Store Connectの年齢制限の質問票への回答を決める（#76）。回答は[`docs/APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「年齢制限の質問票」。
- [x] MacとApple Vision Proで配信するかを決める（#86）。v1.0ではApp Store Connectの既定のまま配信を止めず、動作確認もしない（[`APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「配信地域」）。提出時に「価格および配信状況」で、MacとApple Vision Proの配信を外していないことを確かめる。

## 検証・配布

- [x] GitHub Actionsの文書検査、Web、Release Archive、iPhone／iPad UIテスト、iPhone／iPad app-update、集約ゲートを成功させる（統合先のrun [`35739657855`](https://github.com/K0mork/knittingEditor/actions/runs/35739657855)、失敗ジョブ再実行後に全11ジョブ成功。統合前は旧リポジトリのrun `35572127914`、全6ジョブ）。
- [x] 提出候補のPRでci-gate、提出候補を含むmainコミットで別のFull iOS validation（iPhone／iPad全テスト、両端末のapp_update、unsigned Release Archive・オフライン資産検査）の成功を確認する。全検証は関連マージ後・夜間・手動実行で行い、Pagesのゲートには含めない。main・夜間の失敗Issueがあれば調査・修正する。（2026-11-03、`main`の`b0a7f26`で`CI and deploy Pages`のrun [`41554607495`](https://github.com/K0mork/knittingEditor/actions/runs/41554607495)の`ci-gate`と、Full iOS validationのrun [`41557279662`](https://github.com/K0mork/knittingEditor/actions/runs/41557279662)の全ジョブが成功）
- [x] 提出用のアーカイブはXcode 27.1（iOS 27.1 SDK）以降で作る。Xcode 26.6以前で作ると、iPhone Duoを開いたときに従来のiPhoneの大きさでしか表示されない（#96）。また、2027年4月からは、App Store ConnectへアップロードするアプリをiOS 27 SDK以降でビルドすることがAppleの必須要件になる（[Appleの告知](https://developer.apple.com/news/?id=k1mtkt1k)、2026-09-09）。CIのXcodeは26.6のまま（#289）なので、手元のXcodeで作る。アップロード前に、アーカイブ内のアプリの`Info.plist`で`DTSDKName`が`iphoneos27.1`以降、`DTXcodeBuild`がXcode 27.1以降のビルド番号（27.1正式版は`27A9275`）であることを確かめる。（2026-11-03、提出用のアーカイブを手元のXcode 27.2（`27B52`）で作り、`DTSDKName`が`iphoneos27.2`であることを確かめた。[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-03-提出用アーカイブのアップロードと審査への提出)）
  - 2026-10-21に手元のXcode 27.1で署名なしのReleaseアーカイブを試作し、SDKとXcodeの版の条件を満たすことを確かめた（[記録](RELEASE_VERIFICATION_RECORDS.md#2026-10-21-提出用アーカイブの試作手元のxcode-271)）。提出用は加入後に署名して作り直すので、この欄は未チェックのままにする。
- [x] App Store Connectでスクリーンショットを登録するときに、次を確かめて[`SCREENSHOTS.md`](SCREENSHOTS.md)を直す（#353）。2027年4月以降に提出するときは、iPhone Duoのスクリーンショットも登録する。（2026-11-03に確かめた）
  - iPhoneで必須のmedium displayの欄を、6.9インチ（1320×2868）の画像だけで満たせるか。→ 満たせない。6.9インチの画像は大きさが無効として登録できなかったので、縮小した6.3インチ（1206×2622）の5枚を登録した。
  - iPhone Duoの外側・内側のどちらが必須か、縦と横のどちらでもよいか、何枚から登録できるか。→ 欄は1つで、外側・内側のどちらの大きさも、縦横どちらの向きも受け付け、必須の表示は無い。最大10枚。v1.0では外側の5枚を登録した。
- 「提出ビルドで」で始まる項目と、TestFlight内部テストの項目は、審査への提出と並行して確かめ、公開の前に終える。提出の前に終えなくてよいが、v1.0は手動公開で提出する（[`RELEASE_RUNBOOK.md`](RELEASE_RUNBOOK.md)の手順7・8）。
- [x] 提出ビルドで実機の機内モードのP0フローを再確認する。開発ビルドではiPad Air（第5世代、2026-09-22）とiPhone 17（2026-10-09）の主要フロー、iPadの機内モード前後の通信監視（2026-10-02）は確認済み。2026-11-03に、TestFlightの提出ビルド1.0 (1)でiPhone 17とiPad Air 第5世代の両方を確かめた（[`REAL_DEVICE_RELEASE_CHECKLIST.md`](REAL_DEVICE_RELEASE_CHECKLIST.md)のM0・M6、[記録](RELEASE_VERIFICATION_RECORDS.md#2026-11-03-testflightでの提出ビルドの確認2526)）。
- [ ] 提出ビルドでFiles、AirDrop、共有先、外部`.knit`の往復と残りの異常系を実機で確認する。開発ビルドでのiPhone・iPadの保存・共有・復元は確認済みだが、2026-11-03にTestFlightの提出ビルド1.0 (1)で、両端末の往復と、キャンセル・上書き・不正形式・巨大解凍データ・オフラインのiCloud Driveでクラッシュしないことを確かめた。読み込み直前のファイル削除（開発ビルドとLLDBが要る）が残り、オフラインのiCloud Driveの理由の表示は#387で扱うため、未チェックとする（[`REAL_DEVICE_RELEASE_CHECKLIST.md`](REAL_DEVICE_RELEASE_CHECKLIST.md)のM3）。
- [x] 提出ビルドで、1000×1000盤面のメモリ、PNG拒否、PDF出力時間を記録する。（2026-11-03、1.0 (1)で両端末とも、PNGの上限超過で保存が押せなくなること、出力が測れないほど短いこと、メモリ不足による終了の記録が無いことを確かめた。メモリの値は測っていない）開発ビルドでの記録は[`REAL_DEVICE_RELEASE_CHECKLIST.md`](REAL_DEVICE_RELEASE_CHECKLIST.md)のM2にある。
- Simulator／Webでの1000×1000保存復元・PDF基準値は[`SIMULATOR_PERFORMANCE_BASELINE.md`](SIMULATOR_PERFORMANCE_BASELINE.md)に記録済み（実機/TestFlight確認の代替ではない）。
- [x] TestFlight内部テストでクラッシュログとメモリ警告を確認する。（2026-11-03、1.0 (1)。TestFlightのクラッシュは0件、両端末の解析データにも当日の記録は無かった）
- [x] App Store ConnectのApp Privacy回答をPrivacy Manifestと照合し、「データを収集しない」と入力する（[`docs/APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「App Store Connectの質問への回答」）。（2026-11-03に入力した）
- [x] 第三者のコンテンツの権利、DSAの事業者申告、審査の連絡先、サインインの要否、価格を、[`docs/APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「App Store Connectの質問への回答」のとおり入力する。審査の連絡先の値はルートの`private/APP_STORE_CONNECT.md`。（2026-11-03に入力した）
- [x] Privacy Policy URLをApp Store Connectへ登録し、公開状態と、審査端末から表示できることを確認する。（2026-11-03に登録した。公開ページがHTTPSで開けることは登録前に確かめた）
- [x] 外部のアドレスから`support@knittingeditor.com`へ送ったメールが届き、同じアドレスから返信できることを確かめる（2026-10-21までに利用者が確かめた）。
- [x] サポートURL`https://knittingeditor.com/support/`をApp Store Connectへ登録する。（2026-11-03）
- [x] 審査メモへ[`docs/APP_REVIEW_NOTES.md`](APP_REVIEW_NOTES.md)の要点を英語と日本語で転記する。（2026-11-03。機内モードの指示を消した版を転記し、文字数で全文が入ったことを確かめた）
- [x] App Store Connectの「著作権」欄に「2026 K0mork」を入力し、販売元が加入者の法的氏名で表示されることを確かめる（[`docs/APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「販売元と著作権表記」）。（2026-11-03）
- [x] 年齢制限の質問票に[`docs/APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「年齢制限の質問票」のとおり回答し、4+になることを確かめる。（2026-11-03、4+になった）
- [x] App Store Connectの配信地域からEU加盟国と中国本土を外す（[`docs/APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「配信地域」）。（2026-11-03）
- [ ] アップロードのたびに、前回より大きいビルド番号を付ける（[`docs/APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「バージョンとビルド番号」）。
- [x] App名、サブタイトル、プロモーションテキスト、説明文、キーワードの文字数をApp Store Connectの画面で確かめる（[`APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「基本情報」「説明文案」）。（2026-11-03）
- [ ] [`APP_STORE_METADATA.md`](APP_STORE_METADATA.md)の「アクセシビリティの表示」の回答を実機で確かめ直してから、App Store Connectへ入力する。
- [ ] 提出後の承認を確認するまで、App Store配布完了とは報告しない。
