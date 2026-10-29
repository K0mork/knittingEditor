# 2026-10-29 — 名前を決めた直後に「出力」が効かなくても、UIテストで押し直す

- 影響: UIテストの補助関数 `assertAllNativeExportActions` を直した（#44）。main `1d2411d` の Full iOS validation（run 40819455228、iPhone 17）で、`testBackslashDocumentNameReachesAllNativeExportActions` が1回目に失敗し、再試行で成功した。
  - 新しい編み図の名前を「決定」で確定した1.7秒後に「出力」を押したが、出力パネルが開かず、「PNGを保存」が45秒出なかった（`:1211`）。問い合わせの遅さは見られず、名前のダイアログが閉じる途中で押した「出力」が効かなかったとみられる。
  - 直したあとは、「出力」を既存の `openSavePanel` で押す。「PNGを保存」が10秒出ず、パネルの「閉じる」も無いときだけ1回押し直す。ほかの出力のテストと同じ開き方になる。
  - アプリの動作は変えていない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 新しいテストは足していない。PRスモークに入っている既存の `testBackslashDocumentNameReachesAllNativeExportActions` が通る経路を直した。
- 検証:
  - 手元のXcode 27.1・KE verify iPhone（iPhone 17、iOS 27.0）で、CIと同じ時間の設定（`-test-timeouts-enabled YES -default-test-execution-time-allowance 150 -maximum-test-execution-time-allowance 240`）を付け、`testBackslashDocumentNameReachesAllNativeExportActions` だけを流した: 成功（66.0秒）。「出力」は1回目のタップでパネルが開き、押し直しは起きなかった。
  - `node scripts/check-pr-smoke-ui-tests.mjs`: 成功（11件）。PRスモークの一覧は変えていない。
  - Webのコードは変えていないため、`npm run typecheck`・`npm test`・`npm run build`・`npm run check:dist`・`npm run test:e2e` は手元では流していない（PRのCIの対象外）。
  - タップが効かない瞬間の再現は手元ではできない。CIはXcode 26.6・iOS 26.5で、手元の版とは違う。最終的な判定はPRのCIと、マージ後のFull iOS validation（iPhone 17・iPad (A16)）で行う。
- デプロイ影響: なし（UIテストだけの変更）。
