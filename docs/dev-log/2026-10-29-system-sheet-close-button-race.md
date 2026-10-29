# 2026-10-29 — 保存シートの「×」が押す直前に消えても、UIテストを下スワイプへ進める

- 影響: UIテストの補助関数 `dismissSystemSheet` を直した（#44）。main `3202df0` の CI（run 40796370630、`ios`（iPhone 17））で、`testBackupExportSheetDismissesBackToEditor` が1回目に失敗し、再試行で成功した。
  - iPhoneではふだん「×」（label「キャンセル」）が5秒以内に見つからず、下スワイプで閉じる。この回は「×」が見つかり、`isHittable` が約9秒かかって true を返した。その直後の `tap()` で同じボタンが見つからず、失敗した。押せると判定してから押すまでの間に、ボタンが消えたとみられる。
  - `tap()` は対象が無いとその場でテストを失敗にするため、下スワイプへ落とす処理まで進めなかった。
  - 直したあとは、`isHittable` が true のとき、`snapshot()` で「×」の枠を取り、その中心を座標で押す。`snapshot()` は要素が消えていると例外を投げるので、テストを失敗にせずに受け取れる。座標でのタップも、要素が消えていれば空振りするだけで、テストは失敗にならない。枠が取れないとき、または押して5秒たっても閉じないときは、今までどおり下スワイプへ進む。診断用の戻り値に、取れた枠を足した。
  - 同じ関数を使う `testRestorePickerDismissesBackToEditor` にも効く。アプリの動作は変えていない。
- 主なファイル: `ios/UITests/KnittingEditorUITests/KnittingEditorUITests.swift`
- テスト: 新しいテストは足していない。既存の2件が通る経路を直した。
- 検証:
  - 手元のXcode 27.1・KE verify iPhone（iPhone 17、iOS 27.0）で、CIと同じ時間の設定（`-test-timeouts-enabled YES -default-test-execution-time-allowance 150 -maximum-test-execution-time-allowance 240`）を付け、`testBackupExportSheetDismissesBackToEditor` と `testRestorePickerDismissesBackToEditor` だけを流した: 2件とも成功（82.6秒、36.6秒）。書き出しの保存シートは「×」が見つからず、下スワイプで閉じた。復元の選択画面は「×」が見つかり、新しく足した座標でのタップで閉じた。
  - 同じ設定で KE verify iPad（iPad (A16)、iPadOS 27.0）でも流した。`testRestorePickerDismissesBackToEditor` は成功した（40.9秒）。「×」を座標で押して閉じ、下スワイプは使わなかった。`testBackupExportSheetDismissesBackToEditor` は3回とも失敗した。失敗した場所は毎回違い、どれも `dismissSystemSheet` より前だった。
    - 1回目: 「出力」が45秒で出ず（`:1057`）、3分の上限を超えた。
    - 2回目: 保存シートが20秒で出ず（`:1071`）、上限を超えた。遅れて出たシートの「×」を座標で押したが、5秒で閉じず、下スワイプへ進んだ。
    - 3回目: 「この編み図を書き出す」が出なかった（`:1061`）。
    - 1回目の時点で、Macのload averageは15分平均で約89あった。下がるのを待って流した3回目でも約17あった。手元の結果は、iPadでの判定には使えない。iPadの判定は、このブランチで手動実行するFull iOS validationで行う。
  - `node scripts/check-pr-smoke-ui-tests.mjs`: 成功（11件）。PRスモークの一覧は変えていない。
  - Webのコードは変えていないため、`npm run typecheck`・`npm test`・`npm run build`・`npm run check:dist`・`npm run test:e2e` は手元では流していない（PRのCIの対象外）。
  - 消える瞬間の再現は手元ではできない。CIはXcode 26.6・iOS 26.5で、手元の版とは違う。最終的な判定はPRのCIと、マージ後のFull iOS validation（iPhone 17・iPad (A16)）で行う。
- デプロイ影響: なし（UIテストだけの変更）。
