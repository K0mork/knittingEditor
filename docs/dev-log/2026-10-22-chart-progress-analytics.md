# 2026-10-22 — 制作量・別日の継続制作・編集後の出力の計測（Web版）

- 影響: #319。Web版で、試し操作と制作の進行、別日の継続制作、編集後の出力を区別するイベントを追加した。`chart_progress`（記号マスの純増の最高値が20・100・500・2000に初めて達したとき、閾値ごとに1回）、`chart_resumed`（別の日に初めて実際に編集したとき、1日1回）、`chart_progress_exported`（到達後の編集状態を出力したとき、閾値ごとに1回）。既存の`chart_exported`には、出力時の状態（`unedited`・`same_state`・`edited_first`・`edited_since_export`）、作成量の区分、編み図の由来を加えた。関係はブラウザ内で判定する。送るのは固定の区分だけで、編み図の内容・名前・ファイル名・座標・ID・ハッシュは送らない。端末内の状態は`localStorage`の`knitting-editor:chart-progress:v1`に最大200件を置き、編み図を削除すると消す。解析が有効な本番Webでだけ動き、iOS版、開発ビルド、自動テスト、オプトアウト中は読み書きしない。オプトアウト時は既存の記録を消す。描画中は盤面全体を走査しない。保存は5秒に1回までと、非表示になったときに行う。盤面のハッシュは、基準を作るときと出力のときに一度ずつ計算する。複数タブ、再読み込み、保存領域の障害、別タブでの削除・上限除外、共有の取りやめ、共有待ちの間の編集、復元・複製の由来は、端末内で重複なく扱う。閾値は仮説として扱う。定義、指標の分母と分子、観測期間、GA4のカスタム定義と閲覧手順は`docs/ANALYTICS.md`にまとめた。プライバシーポリシーの製品イベント表と、端末内の記録の説明を更新した。
- 主なファイル: `packages/editor-core/chartProgress.ts`、`packages/editor-core/analytics.ts`、`packages/editor-core/model/BoardHistory.ts`、`packages/editor-core/state/useEditorSession.ts`、`packages/editor-core/ui/useEditorController.ts`、`packages/editor-core/package.json`、`src/analytics.ts`、`docs/ANALYTICS.md`、`public/privacy/index.html`、`docs/ARCHITECTURE.md`、`ios/docs/WEB_SYNC.md`。
- テスト:
  - `chartProgress.test.ts`（新規）：試し操作と到達、出力状態の4種類、日付の境界と別日の再編集、再読み込み、2タブ、復元・複製・既存の基準、操作時間、保存・送信の障害、上限・削除からの非復活と開き直し、出力の順序、300件の一括登録、1000×1000で編集ごとに盤面を読まないこと。
  - `useEditorController.progress.test.tsx`（新規）：編集画面からの到達・再出力・取りやめ・送信例外・iOS相当で保存領域に触れないこと・削除・由来・背景色。
  - そのほか`BoardHistory`、`useEditorSession`、`src/analytics`、区分関数のテストを更新した。
  - E2E `tests/e2e/chart-progress-analytics.spec.ts`（新規）：自動ブラウザで編集・Undo/Redo・作成・切り替え・PNG出力・再読み込みをしても計測キーが作られず、解析の通信もないこと。オプトアウト時に既存のキーが消えること。
- 検証:
  - Node v26.8.1（CI指定はNode 24）で、`npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e`（Chromium mobile・WebKit mobile・Chromium desktop）が成功した。
  - プライバシーポリシーは、390pxと1280pxで表示を確かめた。長いイベント名が表の1列目を広げていたので、その名前だけ区切りの位置で折り返すようにした。変更後に`tests/e2e/contrast.spec.ts`・`csp.spec.ts`・`seo.spec.ts`を流し直し、成功した。
  - iOS Webは`cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit && ../../node_modules/.bin/vitest run --config vite.config.ts`が成功した。
  - 性能はNodeでの比較にとどめた。150×60と1000×1000の盤面に、20マスの筆を500回確定する時間を計測ありとなしで比べ、中央値はほぼ同じだった。ほかに200件分の記録のJSONサイズと、出力時のハッシュ計算1回の時間を測った。
  - 自動ブラウザでは解析が無効になるため、実ブラウザでの計測ありの操作性・メモリの比較はしていない。iPhone・iPadの検証はPRのCIと`ios-full.yml`で確かめる（共通コードの変更でもiOS版は計測を動かさない）。
- デプロイ影響: マージ・配信は未実施。配信するとWeb版のGA4に4種類のイベント・パラメータが加わり、解析が有効なブラウザに計測用の`localStorage`キーができる。配信後は利用者がGA4にイベント範囲のカスタムディメンション10項目を登録し、リアルタイムまたはDebugViewでイベントとパラメータの受信を確かめる。手順は`docs/ANALYTICS.md`。集計できることの確認が済むまで、#319は閉じない。
