# App Store提出チェックリスト

## 実装・資産

- [ ] Apple Developer Team、Bundle ID、署名証明書、Provisioning Profileを確定する。
- [ ] AppIconの最終デザインと全サイズを登録する。
- [ ] 起動画面を確認する。
- [ ] iPhone／iPadの実機スクリーンショットを撮影する。
- [x] `App/PrivacyInfo.xcprivacy`を同梱し、収集データなし・トラッキングなしと一致させる。
- [x] アプリ内ヘルプへプライバシーとサポート導線を同梱する。
- [x] App Review 4.2向けのネイティブ統合説明を`docs/APP_REVIEW_NOTES.md`へ記録する。

## 検証・配布

- [ ] GitHub ActionsのWeb、Swift、iPhone／iPad UIテストを成功させる。
- [ ] 実機で機内モードのP0フローを完了する。
- [ ] Files、AirDrop、共有先、外部`.knit`の往復を実機で確認する。
- [ ] 1000×1000盤面のメモリ、PNG拒否、PDF出力時間を記録する。
- [ ] TestFlight内部テストでクラッシュログとメモリ警告を確認する。
- [ ] App Store ConnectのApp Privacy回答をPrivacy Manifestと照合する。
- [ ] 審査メモへ`docs/APP_REVIEW_NOTES.md`の要点を転記する。
- [ ] 提出後の承認を確認するまで、App Store配布完了とは報告しない。
