# 2026-11-19 — 文字サイズ変更直後の操作メニュー位置測定を、大きな文字のレイアウト反映後にする

- 影響: `tests/e2e/layout-focus-and-hover.spec.ts`が、ルートの文字サイズを書き換えた直後に`.action-bar`の位置を測っていて、まれに失敗する（#425）。`packages/editor-core/ui/EditorView.tsx`の`watchHeaderLayout`は`ResizeObserver`の折にルートの文字サイズを読み、21px以上なら`.app-shell`へ`data-large-text`を付ける。この反映は書き換えより後なので、初回測定が反映前、選択解除後の再測定が反映後になり、位置の一致比較が失敗していた。測定の前に、予定した`data-large-text`の付け外し（16pxでは付かない、28px・48pxでは値空で付く）を確かめ、操作帯の位置が2フレームを挟んで変わらなくなるのを待つ`setRootFontSizeAndSettle`を追加した。アプリの実装は変えていない（範囲選択の解除で配置は壊れていない）。緩い比較や再試行は加えていない。
- 主なファイル: `tests/e2e/layout-focus-and-hover.spec.ts`
- テスト: 既存のE2Eテストの測定手順を直した。新しいテストは追加していない。`setRootFontSizeAndSettle`が、16pxでは`data-large-text`が付かないこと、28px・48pxでは値空で付くことを各構成で確かめる。
- 検証: `npm run typecheck`、`npm test`（1179件成功）、`npm run build`、`npm run check:dist`（dist verified）が成功した（Node.js v26.8.1）。`npm run test:e2e`（この作業環境ではブラウザを起動できないため）と、`npx playwright test tests/e2e/layout-focus-and-hover.spec.ts --repeat-each 10 --workers 8`による反復検証はリーダーが実行する。
- デプロイ影響: なし（アプリの実装と配信物は変わらない）。
