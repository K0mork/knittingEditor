# 2026-11-19 — 静的なページの同じタブへのリンクで`link_clicked`を確実に送る

- 影響: 静的なページで同じタブへ移るリンクを押したとき、ページの切り替えがgtag.jsの送信に先立ち、`link_clicked`が失われていた（#465で本番確認済み）。`public/analytics.js`を、そのようなクリックでは既定の動作を止め、`transport_type: 'beacon'`で`link_clicked`を送ってから、gtag.jsが送った後に呼ぶ`event_callback`で移動するようにした。コールバックが来ないとき（gtag.jsが広告ブロックで止められる・読み込めない・失敗する）も、500ミリ秒の猶予のあとに必ず1回だけ移動する。修飾キー・主以外のボタン・新しいタブ・別フレーム・`download`・すでに既定の動作が止められたクリックと、計測しない環境（`navigator.webdriver`・User-Agentの`Claude/`・オプトアウト・本番以外のドメイン）は、従来どおりブラウザの既定の動作のまま送るだけにする。iOS版は`analytics.js`を読み込まないため影響しない。
- 主なファイル: `public/analytics.js`、`src/staticPageAnalytics.test.ts`、`docs/ANALYTICS.md`
- テスト: `src/staticPageAnalytics.test.ts`で、同じタブのクリックで`link_clicked`に`transport_type: 'beacon'`・`event_callback`・`event_timeout`が付き、コールバックが来るまで移動せず、コールバックが来なくても猶予の時間で移動が1回だけであること、`target="_self"`を同じタブとして扱うことを確かめる。修飾キー・主以外のボタン・`target="_blank"`・`download`・すでに既定の動作が止められたクリックとオプトアウトでは、既定の動作を止めずbeaconもコールバックも付けないことも確かめる。
- 検証:
  - `npm run typecheck`、`npm test`（すべて成功）、`npm run build`、`npm run check:dist`が成功した。
  - `npm run test:e2e`を3つのPlaywrightプロジェクト（Chromium mobile・desktop、WebKit mobile）で実行し、689件成功した。E2Eは`navigator.webdriver`で計測が除外されるため、遷移を確かめるが、GA4への送信は確かめない。
- デプロイ影響: あり（Pagesへ配信される）。配信後に本番の`/guide/`で「編み図を作成する」を押したときの`link_clicked`（`link_name: editor`）がGA4 Realtimeに届くことを確かめ、#465を閉じる。
