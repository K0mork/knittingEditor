# 2026-11-04 — 文字を200%以上にしても、編集画面と使い方のページの文字が大きくなり、切れないようにする

- 影響: iOSのDynamic TypeをAX3以上にしたとき（#389）、ヘッダーの「使い方」「編み図」と範囲選択の帯のボタンは`min(1rem, 20px)`で止まって大きくならなかった。編み図名・記号名・パネルの見出し・盤面設定の段数と列数の欄は切れ、「使い方」のページは文字が大きくならなかった。iPhoneでは記号名が消え、「範囲」「線」が画面の外に出た。次のように直した。
  - 文字の上限をなくし、文字は端末の設定どおりに大きくする。省略記号で切っていた編み図名（一覧）・記号名・見出しは折り返す。ヘッダーの編み図名だけは2行までにする。全体は「編み図」パネルの一覧で読める。保存中・保存失敗の表示は名前と分け、2行に収まらない長い名前でも隠れない。
  - ルートの文字が21px以上（iOSの「さらに大きな文字」のxxL以上）のときだけ、編集画面に`data-large-text`を付けて配置を切り替える。対象は、ヘッダーの折り返し、ツールバーと範囲選択の帯の1行の横スクロール（端のぼかしで続きを示す）、記号パネルの列数の自動調整、盤面設定の入力欄の縦並び、パネル見出しの折り返し。既定の文字サイズでは以前と同じ見た目のままにする。下の操作列（盤面・ブロック・出力・戻す・やり直す）は折り返し、スクロールしなくても全部押せる。
  - ヘッダーの高さを測ってCSS変数`--app-header-height`に入れ、パネル（盤面設定など）はヘッダーの下から開く。文字が大きくヘッダーが伸びても「使い方」「編み図」を覆わない。
  - iOSの「使い方」のページは`-apple-system-body`で本文をDynamic Typeに合わせ、見出しの上限もremにした。メールアドレスのような長い語は折り返す（Web版の使い方のページも同じ）。
  - Web版も、ブラウザの文字サイズを大きくしたときに同じ配置になる。
- 主なファイル: `packages/editor-core/styles/base.css`、`packages/editor-core/ui/EditorView.tsx`、`ios/Web/src/styles.css`、`ios/Web/src/App.tsx`、`src/styles.css`、`ios/Web/public/guide/index.html`、`public/guide/index.html`
- テスト:
  - `tests/e2e/larger-text.spec.ts`を追加した。WebとiOSのCSSで、iPhone 17とiPad (A16)の大きさ（縦・横）、ルート40px（AX3）と53px（AX5）について次を確かめる: 文字が既定の1.9倍以上になる、ヘッダー・ツールバー・選択帯・記号パネル・盤面設定の文字が切れない、横スクロールの帯のボタンにスクロールで届き覆われない、下の操作列はスクロールなしで押せる、盤面設定を開いてもヘッダーのボタンが覆われない、長い編み図名が一覧で全部読め保存状態が見える、範囲選択中も盤面が120px以上残る、使い方のページが横にはみ出さない。既定の文字サイズ（Web 16px、iOS 17px）で、ヘッダーが1段、記号パネルが3列・5列、帯がスクロールしないことも確かめる。
  - `tests/e2e/editor.spec.ts`の横向きの大きな文字のテストは、ボタンの文字が20px以下であることではなく、大きくなりヘッダーと盤面が画面に収まることを確かめるようにした。`tests/e2e/layout-focus-and-hover.spec.ts`は、横スクロールの帯のボタンをスクロールしてから覆われていないことを確かめる。
  - `EditorView.test.tsx`に、ヘッダーの高さと`data-large-text`の切り替え（21pxの境界、`ResizeObserver`が無いときの`resize`、アンマウント時の後片付け）のテストを追加した。`ios/Web/src/guideVersion.test.ts`に、使い方のページが`-apple-system-body`を使い、`px`の文字サイズが無いことのテストを追加した。
  - iOSのUIテストに、横スクロールの帯のボタンを少しずつ送って押せる位置に出す補助を足し、AX5の範囲選択のテストで使うようにした。AX3で主な操作・盤面設定・記号パネルを確かめる`testAccessibilityExtraLargeKeepsPrimaryControlsUsable`を追加した（PRスモークには入れない）。
- 検証:
  - `npm run typecheck`、`npm test`（80ファイル・1017件成功）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium・WebKit、618件成功・36件スキップ）。途中の全体実行では、保存が始まると名前と保存状態の行の高さの違いでヘッダーが約2px伸び、盤面がずれる失敗が8件あったので、行の高さをそろえて直した。`node scripts/check-pr-smoke-ui-tests.mjs`、`git diff --check`。
  - 手元のXcode 27.2で、KE verify iPhone（iPhone 17、iOS 27.2）とKE verify iPad（iPad (A16)、iOS 27.2）で`testAccessibilityExtraExtraExtraLargeKeepsPrimaryControlsUsable`・`testAccessibilityExtraExtraExtraLargeKeepsSelectionActionsSeparate`・`testAccessibilityExtraExtraExtraLargeKeepsLandscapeHeaderInWindow`・`testAccessibilityExtraLargeKeepsPrimaryControlsUsable`を実行し、両端末で4件とも成功した（iPhoneは保存状態の行の高さを直す前のビルド、iPadは直したあとのビルド）。テストが残す画面写真で、AX3とAX5の表示を確かめた。
  - 実機での確認と、`ios/docs/APP_STORE_METADATA.md`の「さらに大きな文字」の回答の見直しはしていない。#389の完了条件なので、このPRでは#389を閉じない。PRのCI（Xcode 26.6）とマージ後のFull iOS validationに残りのiOSのテストを任せる。
- デプロイ影響: Pagesへ配信される（Web版の見た目は既定の文字サイズでは変わらない）。iOSは次のビルドから。配信後に、本番でブラウザの文字サイズを大きくして、ヘッダーと範囲選択の帯が切れないことを確かめる。
