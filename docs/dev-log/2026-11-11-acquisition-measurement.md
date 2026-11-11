# 2026-11-11 — 流入の見分け方と、獲得を判断する指標を決める

- 影響: 編集画面のApp Storeのリンク（アプリの案内と、編み図パネルの注記）を押したときに、`link_clicked`（`link_name`は`app_store`）を送るようにした。参照元はこれまでどおりApp Store Connectの集計にも残る。あわせて、外部に貼るURLのUTMの規則、獲得を判断する指標、Search Consoleから記事の題材を決める手順を`docs/GA4_ANALYSIS.md`に書いた。指標は「直近7日間に、初めて来た利用者が編み図を作り、PNGかPDFを出力した人数」で、`first_visit`・`chart_created`・`chart_exported`のファネルを利用者単位で見る。数値は`private/`に残し、公開の場には書かない。静的なページも同じ`link_clicked`を送る（`public/analytics.js`、#478）。
- 主なファイル: `src/analytics.ts`（`trackLinkClick`）、`src/appStoreNotice.tsx`、`src/App.tsx`、`src/analytics.test.ts`、`src/appStoreNotice.test.tsx`、`docs/ANALYTICS.md`、`docs/GA4_ANALYSIS.md`
- テスト: `src/analytics.test.ts`に、`link_clicked`が`link_name`と`app_build`付きで並ぶことを確かめるテストを足した。`src/appStoreNotice.test.tsx`に、App Storeを開いたときに`trackLinkClick('app_store')`が呼ばれ、閉じただけでは呼ばれないことを確かめるテストを足した。
- 検証:
  - `npm run typecheck`、`npm test`（1090件成功）、`npm run build`、`npm run check:dist`が成功した。
  - `npm run test:e2e`は647件成功、37件スキップ、失敗0件だった。
  - UTM付きのリンクからの流入の確認は、実際にUTM付きのURLをどこかに置いてからでないとできない。配信後に確かめる（#466の完了条件）。
- デプロイ影響: あり（Pagesへ配信される）。配信後、編集画面のApp Storeのリンクを押し、`link_clicked`がGA4 Realtimeに届くことを確かめる。UTMの規則は、次にSNSや記事へリンクを置くときに使い、`sessionSource`でUTMなしと区別できることを確かめる。
