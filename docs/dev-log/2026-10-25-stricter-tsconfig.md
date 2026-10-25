# 2026-10-25 — TypeScriptの型検査を厳しくする

- 影響: 利用者から見える挙動の変更はない。共通の`tsconfig.base.json`に`noUnusedLocals`・`noUnusedParameters`・`noFallthroughCasesInSwitch`を加え、Web版とiOS版Webのアプリ本体（`src`・`packages`・`ios/Web/src`）で、使っていない変数・引数と`switch`の意図しないフォールスルーを型エラーにする。Vite設定を検査する`tsconfig.node.json`と`ios/Web/tsconfig.node.json`は共通設定を継承しておらず`strict`が外れていたので、両方に`"strict": true`を加えた。既存のコードはどちらの設定でもエラーにならず、ソースの修正は要らなかった。2つの`tsconfig.node.json`は共通ファイルにまとめていない（中身が6行と小さく、まとめるとiOSビルドの入力ハッシュとCIの変更判定に追う対象が増えるため）。
- 主なファイル: `tsconfig.base.json`、`tsconfig.node.json`、`ios/Web/tsconfig.node.json`。
- テスト: 設定の変更だけなので、テストの追加・更新はない。一時的なファイル（コミットしない）で、未使用の変数・引数とフォールスルーが`tsconfig.base.json`を継承した設定でTS6133・TS7029になることを確かめた。
- 検証:
  - ローカルのNodeはv26.8.1（CI指定はNode 24）。
  - `npm run typecheck`：成功。
  - `node_modules/.bin/tsc -p tsconfig.app.json --noEmit`・`node_modules/.bin/tsc -p tsconfig.node.json --noEmit`：どちらも成功。`--showConfig`で、appに4つのフラグ、nodeに`strict`が効いていることを確かめた。
  - `ios/Web`で`../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`と`../../node_modules/.bin/tsc -p tsconfig.node.json --noEmit`：どちらも成功。
  - `npm test`：1回目は783件中2件が失敗した（同じマシンで他の作業が並行して動いており、失敗したテスト名はログに残せなかった）。続けて3回実行し、3回とも71ファイル・783件すべて成功。`npm test -- --maxWorkers=2`も783件すべて成功。この変更は型検査の設定だけで、Vitestの実行結果には影響しない。
  - `ios/Web`で`../../node_modules/.bin/vitest run --config vite.config.ts`：16ファイル・139件すべて成功。
  - `npm run build`、`npm run check:dist`：どちらも成功。
  - コミット後に`npm run typecheck`（成功）、`npm test -- --maxWorkers=2`（783件成功）、`npm run test:e2e`（全project、524件成功・7件スキップ）を実行した。
  - iPhone・iPadのテストは手元では実行していない。PRのCIに任せる。
- デプロイ影響: なし（加えた設定は型検査だけに効き、bundleの生成方法は変わらない）。`tsconfig.base.json`はiOSのWebビルドの入力ハッシュに含まれるので、iOSのWebビルドは一度作り直される。
