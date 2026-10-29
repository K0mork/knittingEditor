# 2026-10-29 — 文字サイズ最大のUIテストの実行時間の上限を4分にする

- 影響: PRスモークの `testAccessibilityExtraExtraExtraLargeKeepsPrimaryControlsUsable` に `executionTimeAllowance = 240` を設定した（#355）。このテストは普段でも約65秒かかる。失敗したCIの実行では、起動に約38秒かかり、XCTestの「Setting up automation session」でさらに約52秒止まって、全体で約200秒になり、3分の上限を超えた。同じ実行の再実行では、この手順は約1秒だった。代わりに別のテスト（`testBackslashDocumentNameReachesAllNativeExportActions`）で約60秒止まっており、テストの中身ではなく、XCTestとSimulator側でときどき起きる停止とみている。テスト内の待ちやスクロールの繰り返しが増えた形跡はなく（両方の実行とも、出力パネルのスクロール確認は9回で、ツールバーの横スワイプは0回）、テストの手順は変えていない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 上のテストに、実行時間の上限と理由のコメントを足した。PRスモークの一覧は変えていない。
- 検証:
  - `node scripts/check-pr-smoke-ui-tests.mjs`: 成功（11件）。
  - `npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`: 成功（16件）。
  - 手元のXcode 27.1・iPhone 17 Simulator（iOS 27.0）で、CIと同じ時間の設定（`-test-timeouts-enabled YES -default-test-execution-time-allowance 150 -maximum-test-execution-time-allowance 240`）を付けて、このテストだけを流した。
    - 1回目（ブラウザのテストと同時に流し、マシンに負荷がかかっていた）: 「Setting up automation session」で約478秒止まり、4分の上限も超えた。テストの手順の外で止まっており、上限の設定では救えない例として記録する。
    - 2回目（`-test-iterations 3`、ほかの処理は止めた）: 3回とも成功（70.6秒、60.3秒、107.0秒）。この手順は5〜8秒だった。
  - CIはXcode 26.6・iOS 26.5で、手元の版とは違う。最終的な判定はPRのCIと、マージ後のFull iOS validationで行う。
- デプロイ影響: なし（UIテストだけの変更）。
