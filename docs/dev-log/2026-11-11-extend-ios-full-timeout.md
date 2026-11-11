# 2026-11-11 — iOSの全検証のios_fullジョブの時間上限を60分にする

- 影響: `Full iOS validation`の`ios_full`ジョブ（iPhone 17・iPad (A16)の全unit/UIテスト）の`timeout-minutes`を45から60にした（#447）。2026-11-11に`ios_full (iPhone 17)`が2回、全テストが終わったあとに45分で取り消された。所要時間の中央値は10/29〜11/01から11/07〜11/11で、iPhoneが33.8分から37.0分、iPadが37.6分から40.4分に伸びている。遅いランナーではUIテストが一様に延び、1回目は合計で8.7分長かった。テストの内容、テストごとの上限（既定150秒・最大240秒）、ほかのジョブの上限は変えていない。
- 主なファイル: `.github/workflows/ios-full.yml`
- テスト: なし（CIの設定のみ）。
- 検証: `git diff`で、変更が`ios_full`ジョブの`timeout-minutes`とその説明だけであることを確かめた。`.github/workflows/ios-full.yml`がYAMLとして読めて、`jobs.ios_full.timeout-minutes`が60であることを確かめた。`git diff --check`（成功）、`node scripts/check-pr-smoke-ui-tests.mjs`（11件）、`sh ios/scripts/check-app-store-docs.sh`（成功）。Node.js v26.8.1。`ios-full.yml`はPRでは実行されず、マージ後の`main`へのpushで実行される。
- デプロイ影響: なし。サイトとアプリの内容は変わらない。マージ後の`Full iOS validation`で、両方の`ios_full`が成功することを確かめる。
