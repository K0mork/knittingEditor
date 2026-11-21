# 2026-11-21 — AX3・AX5で主な操作を一巡するSimulator用UIテスト

- 影響: iOSの文字サイズAX3（アクセシビリティL）とAX5（アクセシビリティXXXL）で、#389の完了条件にある主な操作を一巡し、各段階の画面写真を残すUIテスト`testAccessibilityLargeTextMainOperationsWalkthrough`を追加した。アプリの動作は変えない。環境変数`KNITTING_EDITOR_LARGE_TEXT_WALKTHROUGH=1`があるときだけ実行し、PR・フルCIではskipする。PRスモークと実機の一覧には入れない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト:
  - 文字サイズごとに1回起動し、新しい編み図の作成、記号と色の選択（色はOSの色選択を開かず、使っている色の一覧から選ぶ）、記号の配置、消去、範囲選択のコピーと貼付、段数・列数の変更、PNG・PDF・`.knit`の保存画面、2つ目の編み図からの切替、使い方の表示と復帰を行う。各段階で画面写真（`lifetime = .keepAlways`）を残し、ヘッダーと操作メニューの主なボタンが画面内で押せること、盤面の記号数、選択・貼付の操作帯（帯全体と帯の中のボタン）が下の操作列のボタンに重ならないことを確かめる。
  - 盤面を押す位置は、盤面の上と左の段・列番号の帯と1マス（30pt）から、表示中の盤面の中に計算する。帯は文字に合わせて広がり、AX3・AX5では上限の42pt（既定の28ptの1.5倍、`canvasLabelMetrics`）になる。
  - AX5のiPhoneでは、範囲選択中と貼付中に、盤面の高さが段・列番号の帯と1マスに満たない。このときは画面写真を残し、#389の既知の問題として`XCTExpectFailure`で記録して、貼付は行わずに続ける。既知の問題として扱うのはAX5のiPhoneで、範囲を選ぶ前は盤面が足りていて、貼付の帯でさらに縮んだ場合だけで、ほかの端末・文字サイズで起きたら失敗にする。「やめる」の重なりも、重なりの失敗だけを想定内にし、「やめる」は操作列に重なっていない上側を押す。
  - 編み図の一覧の項目が画面の3分の1より高いとき（AX5で約490pt）は、全体を画面に収められないので、項目のあるパネル（枠が取れないときは項目の列）の上で短く送り、動きが止まってから、パネルの中で見えている部分を押して切り替わることを確かめる。
- 検証:
  - `TEST_RUNNER_KNITTING_EDITOR_LARGE_TEXT_WALKTHROUGH=1 xcodebuild test -project ios/knittingEditor.xcodeproj -scheme knittingEditor -destination 'platform=iOS Simulator,name=<Simulator>' -only-testing:knittingEditorUITests/KnittingEditorUITests/testAccessibilityLargeTextMainOperationsWalkthrough CODE_SIGNING_ALLOWED=NO`を、KE verify iPad（iPad (A16)、iOS 27.2、Xcode 27.2）とKE verify iPhone（iPhone 17、iOS 27.2）で実行し、どちらも成功した。
  - iPadはAX3・AX5とも全段階が既知の問題なしで通った。
  - iPhoneはAX3の全段階が通った。AX5では、範囲を選ぶと選択の帯で盤面の高さが69ptになり（帯の42ptを除くと1段に満たない）、貼付中は10ptになって貼り付け先のマスが見えず、貼付の案内の帯が盤面を覆い、「やめる」（高さ79pt）の下側56ptが下の操作列に重なった。画面写真では、操作列の後ろに入って文字が見えない（#389に記録する）。そのほかの段階は通り、一覧の項目は約490ptと高いが押して切り替えられた。
  - 上の実行は`main`の`51698ac`から分けたブランチで行った。その後に取り込んだ`main`（`8bc5ad9`まで）の変更は、版番号・文書・ほかのテストだけで、アプリの画面は変わらない。
  - 2回のレビューの指摘（既知の問題として扱う条件、帯全体の重なり、盤面の帯の幅、一覧の送り方、パネルの枠が取れないときの動き、範囲選択中の盤面の高さ）を直したあと、両端末で実行し直し、どちらも成功した。iPhoneのAX5で想定内として記録したのは、範囲選択中の盤面の高さ（69pt）、貼付中の盤面の高さ（10pt）、「やめる」が「盤面」「ブロック」に重なることの4件だけだった。
  - その前の1回の実行で、iPadのAX3の最初の段階（新しい編み図を作った直後）に、既存の`positionSaveProbeCanvas`が盤面の1秒の静止を10秒待って間に合わなかった。そのほかの段階は通り、最後の実行では起きなかった。
  - 途中の実行で、iPhone AX5の一覧の送り方（上へ送り続けて項目を通り過ぎた）とiPad AX5の送る位置（盤面の上で動かした）が誤っていたため直し、上の実行はその後のコードで行った。
  - `xcrun --sdk iphonesimulator swiftc -typecheck`（成功。既存の警告のみ）、`git diff --check`、`node scripts/check-pr-smoke-ui-tests.mjs`、`npm test -- scripts/check-pr-smoke-ui-tests.test.mjs`が成功した。
  - 追加したUIテストは環境変数が無いとskipするため、`ios-full.yml`のブランチでの実行は行わない。
- デプロイ影響: なし。テストのみの変更で、TestFlight・App Storeの提出物も変わらない。
