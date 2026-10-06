# 2026-10-06 — 操作のヒントを約10秒で消し、案内の文言を入力方法に合わせる

- 影響: 盤面の右下の操作のヒントがずっと出ていて下の段を隠していたこと、タッチ向け・キーボード向けの文言が合わない端末でも出ていたことを直した（#89）。Web版とiOS版の両方に入る。
  - 操作のヒントは、編集画面を開いてから10秒で消える（0.6秒でフェードする。`prefers-reduced-motion: reduce`のときはフェードしない）。もともと`pointer-events: none`なので、出ている間も盤面の操作を妨げない。
  - ヒントは、タッチでは「1本指：{モード}　2本指：移動・拡大」、マウス・トラックパッドでは「ドラッグ：{モード}　ホイール：移動　Ctrl（Macでは⌘）＋ホイール：拡大」にした。貼り付けモードのマウス向けは「クリック：貼り付け」。
  - 貼り付けの案内は、タッチでは「タップ」、マウスでは「クリック」。
  - 記号の一覧の「Escapeで閉じます。」は、キーボードがあると見込める環境でだけ出す。
  - 元に戻す・やり直すの`title`は、MacとiPhone・iPadでは「⌘Z」「⇧⌘Z」、それ以外では「Ctrl+Z」「Ctrl+Y」だけを出す。
  - 入力方法は、まず`(pointer: coarse)`と`(hover: hover)`で判定し、その後は最後に使われたポインターの種類（`pointerdown`の`pointerType`、トラックパッドの`wheel`）で切り替える。iPadにトラックパッドをつないだ場合にも合わせるため。キーボードは、ソフトウェアキーボードでは押せないキー（Escape、Tab、矢印など）か、Ctrl・⌘との組み合わせが押されたら、あるとみなす。
  - 読み上げ用の盤面の説明（`board-instructions`）は「タップまたはドラッグ」「2本指またはトラックパッド」と、どの入力方法にも当てはまる書き方なので変えていない。
- 主なファイル: `packages/editor-core/ui/inputEnvironment.ts`（新規）、`packages/editor-core/ui/EditorView.tsx`、`packages/editor-core/ui/StitchPicker.tsx`、`packages/editor-core/ui/useEditorController.ts`、`packages/editor-core/styles/base.css`
- テスト: `packages/editor-core/ui/inputEnvironment.test.tsx`を足した（最初の判定、Appleの端末の判定、文言、最後に使われた入力への切り替え）。`packages/editor-core/ui/EditorView.test.tsx`で、ヒントの文言の期待を直し、ヒントが10秒で消えることと、マウスでの貼り付けの案内のテストを足した。`tests/e2e/editor.spec.ts`に、端末ごとのヒント・記号の一覧の説明・元に戻すの`title`と、ヒントが約10秒で消えることのテストを足した。既存の消去のテストは、ヒントの文言ではなく「消す」ボタンの押下状態でモードを確かめるようにした。iOSのUIテストはヒントや文言に依存していないので変えていない。
- 検証: `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e`（chromium-mobile、webkit-mobile、chromium-desktop）、iOS Web の `tsc -p tsconfig.app.json --noEmit` と `vitest run --config vite.config.ts`。結果はPR本文に記す。手元のNode.jsは26で、指定の24ではない。デスクトップ（Chromium）、iPhone 14（WebKit、動きを減らす設定）、iPad（WebKit）で、ヒント、記号の一覧、10秒後の表示をスクリーンショットで確かめた。iPadにトラックパッドをつないだ場合とiOSのSimulatorでの確認、Simulatorのテスト一式は、実機・Simulatorが要るためPRのCIに任せた（Swiftとビルド設定は変えていない）。
- デプロイ影響: Pagesへ配信される。配信後に `https://knittingeditor.com/` で、ヒントが約10秒で消えることと、PCではマウス向けの文言になることを確かめる。
