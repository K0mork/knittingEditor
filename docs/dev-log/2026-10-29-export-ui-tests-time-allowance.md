# 2026-10-29 — 書き出しのUIテスト2件の実行時間の上限を4分にする

- 影響: PRスモークの `testShareSheetsDismissBackToEditor` と `testBackslashDocumentNameReachesAllNativeExportActions` に `executionTimeAllowance = 240` を設定した（#358）。テストの手順は変えていない。直近のPR CIとFull iOS validation（2026-10-25〜10-29の29回）のログで所要時間を集めた。
  - `testShareSheetsDismissBackToEditor`: 38回で121〜179秒で、最も遅い回は179.3秒だった（3分の上限まで1秒未満）。手順ごとの時刻（`t =`）を見ると、長く止まる手順は無かった。要素の問い合わせや待ち（1回に約1秒）が4種類の書き出しで積み重なっている。
  - `testBackslashDocumentNameReachesAllNativeExportActions`: 普段は約40〜70秒。96〜160秒かかった3回は、前のテストのアプリの終了（約27〜31秒）か、起動時の「Setting up automation session」（13〜60秒）で止まっていた。どちらもテストの手順の外で起きている。
  - 上限を超えた実行は無かった。UIテストの `Failed to terminate com.k0mork.knittingEditor` は1回だけ（run 40258796398 の1回目）で、ほかに再発していないので、別のIssueにはしない。単体テストのログに出る `Failed to terminate process`（`com.apple.extensionKit.errorDomain`）はWebKit側の記録で、テストの失敗ではない。
  - PRスモークのUIテストは直近で合計約10〜11分かかり、目安の約8分を超えている。今回はスモークの一覧を変えない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 上の2件に、実行時間の上限と理由のコメントを足した。PRスモークの一覧は変えていない。
- 検証:
  - `node scripts/check-pr-smoke-ui-tests.mjs`: 成功（11件）。
  - `npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`: 成功（16件）。
  - 手元のXcode 27.1・iPhone 17 Simulator（iOS 27.0）で、CIと同じ時間の設定（`-test-timeouts-enabled YES -default-test-execution-time-allowance 150 -maximum-test-execution-time-allowance 240`）を付けて、この2件だけを流した: 2件とも成功（`testBackslashDocumentNameReachesAllNativeExportActions` 85.8秒、`testShareSheetsDismissBackToEditor` 142.8秒）。
  - CIはXcode 26.6・iOS 26.5で、手元の版とは違う。最終的な判定はPRのCIと、マージ後のFull iOS validationで行う。
- デプロイ影響: なし（UIテストだけの変更）。
