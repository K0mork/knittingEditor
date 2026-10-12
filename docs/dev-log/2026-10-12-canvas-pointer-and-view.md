# 2026-10-12 — キャンバスの入力と編み始めの初期表示

- 影響: Closes #174、Closes #204、Closes #211。描くモードの右ボタンは押したセルだけを消し、押したまま動かしても離しても編集しない。消すモードの右ドラッグは従来どおり線に沿って消す。初めて表示する編み図は倍率を維持したまま右下の1段・1目が見える位置に置く。回転・リサイズでは既存の位置制限だけを適用する。盤面をTabの停止先とapplicationから外し、名前と説明を持つregionにする。番号帯は既定幅28pxの1.5倍（42px）までに制限し、上限で止めたときは最も長い段番号の幅に8pxを足しても帯を超えない大きさまで番号の文字を縮める（Webの大きなroot font、iOSのDynamic Type）。描画中に帯へ出て盤面へ戻った場合は再進入セルから再開し、帯の位置には描かない。
- 主なファイル: `packages/editor-core/canvas/BoardCanvas.tsx`、`packages/editor-core/canvas/BoardCanvas.test.ts`、`tests/e2e/canvas-pointer-and-view.spec.ts`、`tests/e2e/editor.spec.ts`（盤面のroleの期待値を`region`へ更新）。
- テスト: Vitestで、描くモードの右押下→移動→離す（`button`/`buttons`付き）、消すモードの右ドラッグ、左描画・消去の帯への退出と再進入、帯の上限と番号の文字の縮小（比例しない文字幅でも測り直して収まること）、狭い盤面・はみ出す盤面の初期表示、アクセシブルな名前・説明とTab停止がないことを検証。新規E2Eで、描くモードの右ドラッグと履歴・コピー・貼り付けのショートカット、消すモードの右ドラッグ、390×844の初期表示で1段・1目の番号が描かれることと拡大後のリサイズで倍率を保つこと、Tabが盤面に止まらないこと、番号帯からの再進入、root font 32px・48pxの1000段で段番号が帯に収まることを検証。
- 検証: Node 24.21.0で次を実行し、すべて成功した。

  ```sh
  npm run typecheck
  npm test                     # 45ファイル・447テスト
  npm run build
  npm run check:dist
  (cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)
  (cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)   # 11ファイル・102テスト
  npx playwright test tests/e2e/canvas-pointer-and-view.spec.ts --repeat-each 2   # 42件成功
  npm run test:e2e             # 285件成功・6件スキップ（chromium-mobile、webkit-mobile、chromium-desktop）
  xcodegen generate --spec ios/project.yml
  xcodebuild test -project ios/knittingEditor.xcodeproj -scheme knittingEditor -destination 'platform=iOS Simulator,id=<iPhone Simulator>' -only-testing:knittingEditorUITests/KnittingEditorUITests/testCanvasLabelsWithLargeTextAndErasePinch
  ```

  iPhone SimulatorのAX XXXLのUIテストは成功し、添付画像で番号が帯に収まることを確認した。390×844（WebKit）と1440×900（Chromium）でroot font 32px・48px・1000段の盤面を撮影し、段番号が帯の中に収まることを確認した。番号の文字の修正より前の同じ変更に対して、iPhone Simulatorで`KnittingEditorUITests`の盤面を探す・触る7件、iPad Simulatorで`KeyboardCommandUITests`の2件と`KnittingEditorUITests`の2件が成功し、regionにした盤面が従来の`otherElements`の検索で見つかることと⌘Z・⇧⌘Zが動くことを確認した。iOSの全スイート、更新復元、Release Archive、オフラインバンドルはPR CIで確認する。VoiceOverでの読み上げは手動で確認していない。
- デプロイ影響: WebとiOSの共通キャンバスに反映される。配信後にHTTPSの編集画面で右ドラッグ、狭い幅での1段・1目、Tab移動と既存ショートカット、大きな文字での番号帯を確認する。
