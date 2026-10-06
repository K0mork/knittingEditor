# App Store提出チェックリスト

## 実装・資産

- [ ] Apple Developer Team、Bundle ID、署名証明書、Provisioning Profileを確定する。Teamは個人でApple Developer Programに加入する予定（2026-10-02に決定、#17）。署名はAutomaticを続ける。
- [x] AppIconのAny・Dark・Tintedを1024×1024で登録する（小サイズはXcodeが生成）。素材・再生成手順は`../design/app-icon/README.md`。
- [x] iPhone・iPadのホーム画面でライト・ダーク・色合いを切り替えて確認した（iOS 18.2）。小サイズは設定のアプリ一覧（iPhone、iOS 27.0）とSpotlight（iPhone・iPad、iOS 18.2）で確認した（#78、PR #94の比較画像）。
- [ ] 起動画面を確認する。
- [x] App Store Connectの提出サイズ（iPhone 6.9インチ 1320×2868、iPad 13インチ 2064×2752）のスクリーンショットを`docs/screenshots/app-store-*.png`へ保存する。
- [ ] iPhone／iPadの実機スクリーンショットを撮影する（任意。提出要件はSimulator素材で満たしている）。
- [x] iPhone 16／iPad (10th generation) Simulatorのスクリーンショット下書きを`docs/screenshots/`へ保存する。
- [x] iPhone 16／iPad (10th generation) Simulatorの起動画面下書きを`docs/screenshots/`へ保存する（最終素材ではない）。
- [x] `App/PrivacyInfo.xcprivacy`を同梱し、収集データなし・トラッキングなしと一致させる。
- [x] アプリ内ヘルプへプライバシーとサポート導線を同梱する。
- [x] 公開Privacy Policy本文を`docs/PRIVACY_POLICY.md`へ用意する。
- [x] App Review 4.2向けのネイティブ統合説明を`docs/APP_REVIEW_NOTES.md`へ記録する。
- [x] App Store提出メタデータの下書きを`docs/APP_STORE_METADATA.md`へ用意する。
- [x] 輸出コンプライアンスのため、`App/Info.plist`へ`ITSAppUsesNonExemptEncryption`を`false`で入れる。
- [x] 同梱する第三者ソフトウェアのライセンス表記を、アプリ内の「使い方」から開ける`/third-party-notices/`へ置く。
- [ ] アカウント無しで非公開に連絡できるサポート窓口とサポートURLを用意する（#75）。
- [x] App Store Connectの年齢制限の質問票への回答を決める（#76）。回答は`docs/APP_STORE_METADATA.md`の「年齢制限の質問票」。
- [ ] MacとApple Vision Proで配信するかを決める（#86）。

## 検証・配布

- [x] GitHub Actionsの文書検査、Web、Release Archive、iPhone／iPad UIテスト、iPhone／iPad app-update、集約ゲートを成功させる（統合先のrun [`35739657855`](https://github.com/K0mork/knittingEditor/actions/runs/35739657855)、失敗ジョブ再実行後に全11ジョブ成功。統合前は旧リポジトリのrun `35572127914`、全6ジョブ）。
- [ ] 実機で機内モードのP0フローを完了する。
- [ ] Files、AirDrop、共有先、外部`.knit`の往復を実機で確認する。
- [ ] 1000×1000盤面のメモリ、PNG拒否、PDF出力時間を記録する。
- Simulator／Webでの1000×1000保存復元・PDF基準値は[`SIMULATOR_PERFORMANCE_BASELINE.md`](SIMULATOR_PERFORMANCE_BASELINE.md)に記録済み（実機/TestFlight確認の代替ではない）。
- [ ] TestFlight内部テストでクラッシュログとメモリ警告を確認する。
- [ ] App Store ConnectのApp Privacy回答をPrivacy Manifestと照合する。
- [ ] Privacy Policy URLをApp Store Connectへ登録し、公開状態を確認する。
- [ ] 審査メモへ`docs/APP_REVIEW_NOTES.md`の要点を転記する。
- [ ] App Store Connectの「著作権」欄に「2026 K0mork」を入力し、販売元が加入者の法的氏名で表示されることを確かめる（`docs/APP_STORE_METADATA.md`の「販売元と著作権表記」）。
- [ ] 年齢制限の質問票に`docs/APP_STORE_METADATA.md`の「年齢制限の質問票」のとおり回答し、4+になることを確かめる。
- [ ] App Store Connectの配信地域からEU加盟国と中国本土を外す（`docs/APP_STORE_METADATA.md`の「配信地域」）。
- [ ] アップロードのたびに、前回より大きいビルド番号を付ける（`docs/APP_STORE_METADATA.md`の「バージョンとビルド番号」）。
- [ ] 提出後の承認を確認するまで、App Store配布完了とは報告しない。
