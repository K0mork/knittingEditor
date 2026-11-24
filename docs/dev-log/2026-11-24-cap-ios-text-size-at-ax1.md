# 2026-11-24 — iOS版の編集画面の文字サイズをAX1で頭打ちにする

- 影響: iOS版の編集画面はDynamic TypeにAX1（本文28px）まで追従し、それより大きい設定ではAX1で止まる。盤面のマスは文字サイズで大きくならず、AX3以上では盤面が画面の半分を割って編み図が見えなくなるため。実行中の変更にも`ResizeObserver`と`resize`で追従する。使い方ページは対象外とし、すべての文字サイズに追従する。#389は対応しないと決め、App Storeの「さらに大きな文字」の回答は「対応と答えない」のまま変えない。
- 主なファイル: `ios/Web/src/{textSizeCap.ts,textSizeCap.test.ts,main.tsx}`、`ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`、`ios/UITests/{pr-smoke-ui-tests.txt,device-ui-tests.txt}`、`ios/SPECIFICATION.md`、`ios/docs/APP_STORE_METADATA.md`
- テスト:
  - `ios/Web/src/textSizeCap.test.ts`を追加した。プローブ要素で実際の文字サイズを読み、上限を超えるときだけ`28px`を設定すること、`ResizeObserver`での再適用、後始末を確かめる。
  - iOSのUIテストは、4件のDynamic TypeテストとAX3・AX5の手動walkthroughを、AX5で起動する1件の`testLargestTextSizeIsCappedAndKeepsBoardAndPrimaryControlsUsable`に置き換えた。盤面が画面の高さの半分以上残り、主要な操作と「編み図」・出力パネルの各ボタンが押せることを確かめる。
  - PRスモークと実機の一覧を更新し、`ios/SPECIFICATION.md`と`ios/docs/APP_STORE_METADATA.md`の記載も頭打ちに合わせた。
- 検証:
  - `cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: 成功（出力なし）。
  - `cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts`: 21ファイル165件成功。
  - `node scripts/check-pr-smoke-ui-tests.mjs`: PRスモーク11件、実機一覧11件で成功。
  - `swiftc -parse ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`: 成功（構文だけの確認）。
  - `grep`で削除したテスト名・補助関数・環境変数を探し、コードと一覧に残っていないことを確認した。
  - XcodeGenとSimulator向けビルドが成功し、iPhone 17 Simulator（iOS 27.2）で`knittingEditorTests`（161件、1件は既存の条件でスキップ）と、UIテスト`testLargestTextSizeIsCappedAndKeepsBoardAndPrimaryControlsUsable`・`testCanvasLabelsWithLargeTextAndErasePinch`が成功した。
  - 同じSimulatorで起動中に文字サイズを標準→AX1→AX3→AX5→特大と変え、AX1以上では編集画面が同じ大きさで止まり、特大へ戻すと小さくなることを画面写真で確かめた。
  - iPad (A16)とiPhone SEでの実行は、PRのCIとこのブランチで手動実行したFull iOS validationで確かめる。
- デプロイ影響: Web版には影響なし。iOS版は次のリリースから反映される。
