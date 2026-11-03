# 2026-11-03 — 範囲選択の操作帯から、選んだ範囲をブロックとして保存できるようにする

- 影響: 範囲を選ぶと出る下の操作帯を「コピーして貼付｜ブロック保存｜解除」にした。これまでブロックの保存は「ブロック」パネルの中にしかなく、範囲を選んだだけではブロックとして残せることが分からなかった。押したときの動きはパネルの「選択範囲をブロック保存」と同じで、名前を入力して保存すると選択が外れ、描画に戻る。ラベルは、幅375pxの画面で標準の文字のときに3つのボタンが1行に収まる長さにした。文字を大きくしたときは2段に折り返し、下のメニューは覆わない。Web版とiOS版の両方に入る。
- 主なファイル: `packages/editor-core/ui/EditorView.tsx`
- テスト: `tests/e2e/selection-save-block.spec.ts`を追加した（操作帯から名前を付けて保存でき、名前の入力を断ると保存しない、再読み込みしても残る）。`tests/e2e/layout-focus-and-hover.spec.ts`で、新しいボタンが覆われないことと、標準の文字なら操作帯が1行に収まることを確かめるようにした。`tests/e2e/editor.spec.ts`では、名前が「ブロック」のボタンを完全一致で探すようにした（部分一致のままだと新しいボタンにも当たるため）。
- 検証: `npx playwright test tests/e2e/selection-save-block.spec.ts tests/e2e/layout-focus-and-hover.spec.ts tests/e2e/editor.spec.ts tests/e2e/guide-content.spec.ts -g "saves a selection|keeps selection and action|creates a block|guide"`は48件すべて成功した。幅375px・390px・1280px（標準の文字）と幅375px（文字20px）のスクリーンショットで見た目を確かめた。`npm run typecheck`は成功、`npm test`は79ファイル・995件すべて成功、`npm run build`と`npm run check:dist`は成功、`npm run test:e2e`は551件が成功した。スキップの7件は、iPhone Safari・タッチ向けのテストを他のブラウザ設定で飛ばしたもの。iOSのUIテストとiOS Webのチェックは、PRのCIと`ios-full.yml`に任せる。
- デプロイ影響: Pagesへ配信される。配信後に`https://knittingeditor.com/`で範囲を選び、操作帯の「ブロック保存」から保存できることを確かめる。
