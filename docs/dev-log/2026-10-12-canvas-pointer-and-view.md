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
- PRのCIでの修正: webkit-mobileで`tests/e2e/editor.spec.ts`の4件が失敗した。原因は2つあった。
  - 遠くへのスクロール・2本指の移動の2件（中央のマスが常に初期位置の段13・目15になる）: 初期位置を最初の描画（次のフレーム）で決めていたため、描画より先に届いたスクロールやタッチの移動が後から初期位置で上書きされていた。手元でも`--repeat-each 5`で20回中4回再現した。実装の不具合として、初期位置を`useLayoutEffect`で表示領域の大きさが分かった時点に決め（大きさが無いときは従来どおり描画時に試みる）、番号帯の幅の計算を描画と共有した。Vitestに、最初のフレームより前のスクロールが失われず、中央のタップが左上のマスに入ることを追加した（修正前は段13・目15に入って失敗することを確かめた）。
  - 盤面の地の色の2件（縞の段の色`243,244,243`が出る）: テストは盤面が左上（帯の8px内側）から始まる前提で画素を見ていたが、#204で狭い画面の初期位置が右下の編み始めに寄るようになり、前提が成り立たなくなった。手元では見る位置が罫線と縞の段のすぐ近くの地に偶然当たって通っており、CIでは盤面の高さの差で縞の段に当たった。テストは、盤面を大きくスクロールして左上のマスを表示領域の中央に置いてから2段目・左端のマスの画素を見るように変えた。確かめる内容（地の色の保存・PNG・外観の切り替え）は変えていない。
  - 確認: Node 24.21.0で`npm run typecheck`、`npm test`（45ファイル・448テスト）、`npm run build`、`npm run check:dist`、iOS Webの型検査とテスト（11ファイル・102テスト）、`CI=1 npx playwright test tests/e2e/editor.spec.ts --project webkit-mobile -g "keeps the board on screen|keeps the chosen board background|follows the dark appearance" --repeat-each 10`（40件成功）と同じく`--repeat-each 3`（12件成功）、`npm run test:e2e`（285件成功・6件スキップ）がすべて成功した。iOSのSimulatorの全スイートはPRのCIで確認する。
- `origin/main`の取り込み: #239で加わった`tests/e2e/editor.spec.ts`の2件（`copies colored symbols including a multi-cell stitch to new positions and undoes the paste`、`exports real symbol pixels and restores a full backup block for pasting`）が、3つのプロジェクトすべてで失敗した（保存されたセルが期待と異なる）。競合は同ファイルの補助関数だけで、手で解消した。
  - 原因: 2件の補助関数`drawRealContent`・`selectRealContent`と貼り付け先のクリックが、盤面が左上（帯28px＋余白8px）から始まる前提の固定座標を使っていた。このPRで初期位置が右下の編み始めに寄るようになり、別のマスを押していた。
  - 修正（テストのみ）: 新しい補助関数`placeBoardOrigin`で、地の色のテストと同じく大きくスクロールして左上のマスを表示領域の中央に置き、さらに3マス（90px）左上へずらしてから、0段目・0目の中央を基準に各マスの中央（基準＋目×30px、段×30px）を押すようにした。復元した編み図は初期位置に置き直されるので、復元後の貼り付けの前にも位置を決め直す。確かめる内容（記号・色・ブロック・貼り付け先・PNGの画素）は変えていない。狭い画面（webkit-mobileの盤面390×477）でも、使う0〜6段・0〜5目が表示領域に収まる。
  - 確認: Node 24.21.0で`npm run typecheck`、`npm test`（48ファイル・487テスト）、`npx playwright test tests/e2e/editor.spec.ts -g "copies colored symbols|exports real symbol pixels" --repeat-each 3`（18件成功）、`npm run test:e2e`（363件成功・6件スキップ）がすべて成功した。
