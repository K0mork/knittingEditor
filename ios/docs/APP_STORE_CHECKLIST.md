# App Store提出チェックリスト

加入から提出・公開までの順序は、[v1.0 加入・提出・公開の手順](RELEASE_RUNBOOK.md)を参照する。

## 実装・資産

- [ ] Apple Developer Team、Bundle ID、署名証明書、Provisioning Profileを確定する。Teamは個人でApple Developer Programに加入する方針（2026-10-02に決定、#17）。2026-10-21にWebで個人情報を入力し、登録申請の審査中・Appleへの問い合わせ案内を確認した。Eメールの問い合わせを送信し、受付完了を確認した。Appleからの回答内容は未確認。契約・支払い・有効化と署名確認は未完了（`RELEASE_RUNBOOK.md`の手順2）。署名はAutomaticを続ける。
- [x] AppIconのAny・Dark・Tintedを1024×1024で登録する（小サイズはXcodeが生成）。素材・再生成手順は`../design/app-icon/README.md`。
- [x] iPhone・iPadのホーム画面でライト・ダーク・色合いを切り替えて確認した（iOS 18.2）。小サイズは設定のアプリ一覧（iPhone、iOS 27.0）とSpotlight（iPhone・iPad、iOS 18.2）で確認した（#78、PR #94の比較画像）。
- [x] 起動画面を確認する。（2026-10-21、`main`の`fda7bbf`をXcode 27.1でReleaseビルドし、KE verify iPhone・KE verify iPad（iOS 27.0 Simulator）へ入れ直して、ライト・ダークの両方で起動を録画した。どれも「起動画面（`LaunchBackground`の緑）→準備中の表示（同じ緑）→編集画面」と移り、白や黒の全面表示は1コマも出なかった。ダークでは編集画面も暗い配色になった。iOS 27のSimulatorで起動画面の緑が準備中の緑より鮮やかに見える件（#117）は変わらないが、実機では起きないことを2026-10-09にiPhone 17で確かめている（`REAL_DEVICE_RELEASE_CHECKLIST.md`）。提出ビルドでの最終確認は`REAL_DEVICE_RELEASE_CHECKLIST.md`のM6で行う）
- [x] App Store Connectの提出サイズ（iPhone 6.9インチ 1320×2868、iPad 13インチ 2064×2752）の、説明文入りの最終スクリーンショットを各5枚、`docs/screenshots/app-store-*.png`へ保存する（2026-10-20、#290。画面・順・文面は`SCREENSHOTS.md`）。
- [ ] iPhone／iPadの実機スクリーンショットを撮影する（任意。提出要件はSimulator素材で満たしている）。
- [x] iPhone 16／iPad (10th generation) Simulatorのスクリーンショット下書きを`docs/screenshots/`へ保存する。
- [x] iPhone 16／iPad (10th generation) Simulatorの起動画面下書きを`docs/screenshots/`へ保存する（最終素材ではない）。
- [x] `App/PrivacyInfo.xcprivacy`を同梱し、収集データなし・トラッキングなしと一致させる。使っている理由の申告が必要なAPI（`UserDefaults`、理由`CA92.1`）を申告し、`scripts/check-app-bundle.sh`で申告漏れを検査する。
- [x] アプリ内ヘルプへプライバシーとサポート導線を同梱する。
- [x] 公開Privacy Policy本文をリポジトリルートの`public/privacy/app/index.html`へ用意する（公開URL: https://knittingeditor.com/privacy/app/、登録は#27）。
- [x] App Review 4.2向けのネイティブ統合説明を`docs/APP_REVIEW_NOTES.md`へ記録する。
- [x] App Store提出メタデータの下書きを`docs/APP_STORE_METADATA.md`へ用意する。
- [x] 輸出コンプライアンスのため、`App/Info.plist`へ`ITSAppUsesNonExemptEncryption`を`false`で入れる。
- [x] 同梱する第三者ソフトウェアのライセンス表記を、アプリ内の「使い方」から開ける`/third-party-notices/`へ置く。
- [x] アカウント無しで非公開に連絡できるサポート窓口とサポートURLを用意する（#75）。窓口は`support@knittingeditor.com`、サポートURLは`https://knittingeditor.com/support/`。
- [x] App Store Connectの年齢制限の質問票への回答を決める（#76）。回答は`docs/APP_STORE_METADATA.md`の「年齢制限の質問票」。
- [ ] MacとApple Vision Proで配信するかを決める（#86）。

## 検証・配布

- [x] GitHub Actionsの文書検査、Web、Release Archive、iPhone／iPad UIテスト、iPhone／iPad app-update、集約ゲートを成功させる（統合先のrun [`35739657855`](https://github.com/K0mork/knittingEditor/actions/runs/35739657855)、失敗ジョブ再実行後に全11ジョブ成功。統合前は旧リポジトリのrun `35572127914`、全6ジョブ）。
- [ ] 提出候補のPRでci-gate、提出候補を含むmainコミットで別のFull iOS validation（iPhone／iPad全テスト、両端末のapp_update、unsigned Release Archive・オフライン資産検査）の成功を確認する。全検証は関連マージ後・夜間・手動実行で行い、Pagesのゲートには含めない。main・夜間の失敗Issueがあれば調査・修正する。
- [ ] 提出用のアーカイブはXcode 27.1（iOS 27.1 SDK）以降で作る。Xcode 26.6以前で作ると、iPhone Duoを開いたときに従来のiPhoneの大きさでしか表示されない（#96）。CIのXcodeは26.6のまま（#289）なので、手元のXcodeで作る。アップロード前に、アーカイブ内のアプリの`Info.plist`で`DTSDKName`が`iphoneos27.1`以降、`DTXcodeBuild`がXcode 27.1以降のビルド番号（27.1正式版は`27A9275`）であることを確かめる。
  - 2026-10-21に、手元のXcode 27.1（`27A9275`）で`main`の`fda7bbf`から署名なしのReleaseアーカイブを試しに作った（CIの`release_archive`と同じ引数）。アーカイブは成功し、`check-release-assets.sh`も通った。アプリの`Info.plist`は`DTSDKName`が`iphoneos27.1`、`DTXcodeBuild`が`27A9275`、`CFBundleShortVersionString`が`1.0`、`CFBundleVersion`が`1`だった。提出用は加入後に署名して作り直すので、この欄は未チェックのままにする。
- [ ] 提出ビルドで実機の機内モードのP0フローを再確認する。開発ビルドではiPad Air（第5世代、2026-09-22）とiPhone 17（2026-10-09）の主要フロー、iPadの機内モード前後の通信監視（2026-10-02）は確認済み。TestFlight等の提出ビルドは未確認なので、この欄は未チェックとする（`REAL_DEVICE_RELEASE_CHECKLIST.md`のM0・M6）。
- [ ] 提出ビルドでFiles、AirDrop、共有先、外部`.knit`の往復と残りの異常系を実機で確認する。開発ビルドでのiPhone・iPadの保存・共有・復元は確認済みだが、存在しないファイルなどの異常系とTestFlightでの最終往復が残るため、未チェックとする（`REAL_DEVICE_RELEASE_CHECKLIST.md`のM3）。
- [ ] 1000×1000盤面のメモリ、PNG拒否、PDF出力時間を記録する。
- Simulator／Webでの1000×1000保存復元・PDF基準値は[`SIMULATOR_PERFORMANCE_BASELINE.md`](SIMULATOR_PERFORMANCE_BASELINE.md)に記録済み（実機/TestFlight確認の代替ではない）。
- [ ] TestFlight内部テストでクラッシュログとメモリ警告を確認する。
- [ ] App Store ConnectのApp Privacy回答をPrivacy Manifestと照合し、「データを収集しない」と入力する（`docs/APP_STORE_METADATA.md`の「App Store Connectの質問への回答」）。
- [ ] 第三者のコンテンツの権利、DSAの事業者申告、審査の連絡先、サインインの要否、価格を、`docs/APP_STORE_METADATA.md`の「App Store Connectの質問への回答」のとおり入力する。審査の連絡先の値はルートの`private/APP_STORE_CONNECT.md`。
- [ ] Privacy Policy URLをApp Store Connectへ登録し、公開状態を確認する。
- [x] 外部のアドレスから`support@knittingeditor.com`へ送ったメールが届き、同じアドレスから返信できることを確かめる（2026-10-21までに利用者が確かめた）。
- [ ] サポートURL`https://knittingeditor.com/support/`をApp Store Connectへ登録する。
- [ ] 審査メモへ`docs/APP_REVIEW_NOTES.md`の要点を英語と日本語で転記する。
- [ ] App Store Connectの「著作権」欄に「2026 K0mork」を入力し、販売元が加入者の法的氏名で表示されることを確かめる（`docs/APP_STORE_METADATA.md`の「販売元と著作権表記」）。
- [ ] 年齢制限の質問票に`docs/APP_STORE_METADATA.md`の「年齢制限の質問票」のとおり回答し、4+になることを確かめる。
- [ ] App Store Connectの配信地域からEU加盟国と中国本土を外す（`docs/APP_STORE_METADATA.md`の「配信地域」）。
- [ ] アップロードのたびに、前回より大きいビルド番号を付ける（`docs/APP_STORE_METADATA.md`の「バージョンとビルド番号」）。
- [ ] 提出後の承認を確認するまで、App Store配布完了とは報告しない。
