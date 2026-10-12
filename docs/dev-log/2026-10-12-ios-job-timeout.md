# 2026-10-12 — CIのiOSジョブの時間上限を45分にする

- 影響: `CI and deploy Pages`の`ios`ジョブ（iPhone・iPadのSimulatorテスト）の`timeout-minutes`を30から45にした。UIテストの追加で、iPad (A16)の実行が成功時でも28〜29分かかるようになり、UIテストを1件足したPR #234では、テストが成功し続けているまま30分で取り消された。テストやジョブの内容、ほかのジョブの上限は変えていない。
- 主なファイル: `.github/workflows/ci.yml`
- テスト: なし（CIの設定のみ）。
- 検証: `git diff`で変更が`ios`ジョブの`timeout-minutes`とその説明だけであることを確かめた。iOSジョブはこのPRのCIで実行される。
- デプロイ影響: なし。サイトの内容は変わらない。
