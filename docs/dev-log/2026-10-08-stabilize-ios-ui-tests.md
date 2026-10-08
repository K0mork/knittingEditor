# 2026-10-08 — iOS UIテストの文字サイズ最大のテストを分け、パネルが開かない失敗の記録を残す

- 影響: iOSのUIテストだけが変わる（#44）。アプリとWeb版の動きは変わらない。
  - #44の観察（PR #55のマージ後から2026-10-08までのCIの実行）で、再試行・時間切れが最も多かったのは`testAccessibilityExtraExtraExtraLargeKeepsPrimaryFlowsUsable`だった。ログでは、文字サイズ最大の画面でXCUITestの操作1回に数十秒かかることがあり、途中での横向きへの回転に19〜59秒かかっていた。その結果、起動中のアプリの一覧の取得、画面の向きの変更、要素の検索が時間切れになるか、テスト全体が実行時間の上限を超えていた。
  - このテストを、確かめる流れごとに3つに分けた。`testAccessibilityExtraExtraExtraLargeKeepsPrimaryControlsUsable`（縦向きの主要な操作と「編み図」パネル）、`testAccessibilityExtraExtraExtraLargeKeepsSaveActionsReachable`（「保存」パネルのスクロール）、`testAccessibilityExtraExtraExtraLargeKeepsLandscapeHeaderInWindow`（横向きでヘッダーが画面内にある）。横向きのテストは起動の前に横向きにし、要素の多い画面での回転をなくした。確かめる内容は分ける前と同じ。
  - 「編み図」を押してもパネルが開かない失敗（`testSeedDocumentForAppUpdateProbe`など）は、原因がまだ分からない。押し直しが入ったあとの失敗では、押し直しの操作自体に10〜42秒かかっており、1回目のタップが遅れて効いて開いたパネルを押し直しで閉じたのか、どちらのタップも効かなかったのかを見分けられなかった。`openDocumentsPanel`で、開かなかったときに各タップの時刻とその前後の「閉じる」の有無を失敗メッセージに書き、画面写真を添付するようにした。押し直しの条件は変えていない。
  - 「編み図」の`aria-expanded`は、XCUITestの`value`に出ない（Simulatorで開いた状態と閉じた状態のどちらも空だった）ため、パネルの有無は「閉じる」で判断している。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: `testAccessibilityExtraExtraExtraLargeKeepsPrimaryFlowsUsable`を上の3つに分けた。`openDocumentsPanel`と、横向きを待つ処理（`waitForLandscapeLayout`）を更新した。
- 検証:
  - `xcodegen generate --spec ios/project.yml`のあと、`xcodebuild build-for-testing`（Xcode 27.0、`CODE_SIGNING_ALLOWED=NO`）が成功。
  - iPhone 16・iPad (10th generation)（どちらもiOS 18.2のSimulator）で、`xcodebuild test-without-building`に分けた3つのテストと、`openDocumentsPanel`を使う`testPrimaryControlsRemainUsableInPortraitAndLandscape`・`testDocumentSwitchAutosavesEachDocument`を`-only-testing`で指定して実行し、両端末とも5件成功した。iOS 27.0のSimulatorは、文字サイズ最大で起動が止まる既知の問題（#64）があるため使っていない。
  - 変更前のコミットとテスト関数の一覧を比べ、消えたのは分けた元のテストだけであることを確かめた。CIとスクリプトの`-only-testing`・`-skip-testing`はこのテストを指定していない。
  - パネルが開かなかったときの記録は、手元では開かない状態を再現できないため、失敗の経路を実行して確かめていない。
  - Simulatorのテスト一式、アプリ更新テスト、Release Archive、同梱物の検査はPRのCIに任せた。iOS WebとWeb版のコードは変えていないため、`npm run typecheck`などは手元で実行していない。
- デプロイ影響: なし（テストだけの変更で、Pagesにもアプリにも入らない）。#44の10回連続の観察は、このPRのマージ後から数え直す。
