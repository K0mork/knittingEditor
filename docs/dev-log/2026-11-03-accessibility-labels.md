# 2026-11-03 — App Storeのアクセシビリティの表示の回答を決める

- 影響: App Store Connectのアクセシビリティの表示の回答を、Appleの判定基準に照らして決めた。ダークインターフェイス・十分なコントラスト・色以外でも区別・視差効果を減らすは「対応」、VoiceOver・音声コントロール・さらに大きな文字は「対応」と答えない。さらに大きな文字は、文字を200%以上（AX3）にするとヘッダーのボタンや編み図名が切れ、使い方のページなどが大きくならないため、#389で直す。アプリのコードは変えていない。
- 主なファイル: `ios/docs/APP_STORE_METADATA.md`、`ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/RELEASE_RUNBOOK.md`、`ios/docs/RELEASE_VERIFICATION_RECORDS.md`
- テスト: 追加・変更なし（文書だけの変更）。確かめるための一時的なUIテストはコミットしていない。
- 検証: Simulator（KE verify iPhone・KE verify iPad、iOS 27.2、`320d25a`のReleaseビルド）で、`simctl ui`の外観・コントラスト・文字サイズを変えて、主な画面の写真を撮って確かめた。視差効果を減らす・グレイスケールは、利用者がTestFlightの1.0 (1)で実機（iPhone 17・iPad Air 第5世代）で確かめた。内容は`RELEASE_VERIFICATION_RECORDS.md`の同日の節。`bash ios/scripts/check-app-store-docs.sh`（成功）、`npx vitest run scripts/app-privacy-docs.test.mjs`（17件成功）、`git diff --check`（成功）。足した記録の節へのリンク2か所が見出しと一致することを確かめた。
- デプロイ影響: なし。Pagesは再配信されない。アプリのビルドにも影響しない。App Store Connectのアクセシビリティの表示は、利用者が表の回答どおりに入力し、下書きとして保存された。v1.0がリリースされたら公開する（手順9）。
