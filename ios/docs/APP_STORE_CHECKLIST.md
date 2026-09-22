# App Store提出チェックリスト

## 実装・資産

- [ ] Apple Developer Team、Bundle ID、署名証明書、Provisioning Profileを確定する。
- [ ] AppIconの最終デザインと全サイズを登録する。
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

## 検証・配布

- [x] GitHub ActionsのWeb、Release Archive、iPhone／iPad UIテスト、iPhone／iPad app-updateを成功させる（統合先のrun [`35719499164`](https://github.com/K0mork/knittingEditor/actions/runs/35719499164)、全9ジョブ。統合前は旧リポジトリのrun `35572127914`、全6ジョブ）。
- [ ] 実機で機内モードのP0フローを完了する。
- [ ] Files、AirDrop、共有先、外部`.knit`の往復を実機で確認する。
- [ ] 1000×1000盤面のメモリ、PNG拒否、PDF出力時間を記録する。
- Simulator／Webでの1000×1000保存復元・PDF基準値は[`SIMULATOR_PERFORMANCE_BASELINE.md`](SIMULATOR_PERFORMANCE_BASELINE.md)に記録済み（実機/TestFlight確認の代替ではない）。
- [ ] TestFlight内部テストでクラッシュログとメモリ警告を確認する。
- [ ] App Store ConnectのApp Privacy回答をPrivacy Manifestと照合する。
- [ ] Privacy Policy URLをApp Store Connectへ登録し、公開状態を確認する。
- [ ] 審査メモへ`docs/APP_REVIEW_NOTES.md`の要点を転記する。
- [ ] 提出後の承認を確認するまで、App Store配布完了とは報告しない。
