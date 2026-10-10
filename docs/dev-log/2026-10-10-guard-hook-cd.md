# 2026-10-10 — 共有checkout保護フックでcd後の作業場所を追跡

- 影響: Claude Codeの保護フックで、worktreeから`cd`でメインへ移ったGit操作を止め、メインからworktreeへ移った操作を許可する。Closes #165。
- 主なファイル: `scripts/guard-shared-checkout.mjs`、`scripts/guard-shared-checkout.test.mjs`。
- 技術的な判断: 引用符・エスケープを含むリテラルの`cd`、`&&`・`;`・改行、subshellと波括弧を追跡し、相対的な`git -C`もその時点の場所から解決する。subshell終了後は親の場所に戻す。変数・コマンド置換・glob・チルダ展開、省略した移動先や`cd -`、`||`・pipeline・backgroundで場所が確定しない場合は、メインの可能性があるため禁止対象の操作を保守的に止める。読み取り操作は許可し、後続の絶対パスで場所が確定すれば通常の判定に戻す。シェル自体や移動は実行しない。完全なシェル解析ではなく、リテラルの`cd`は成功した場合の場所を追跡する（`;`の前の`cd`失敗など、実行時の分岐は再現しない）。
- テスト: 両方向の`cd`、複数回の相対移動、複数の`git -C`、ネストしたsubshellと親への復帰、`gh pr checkout`、引用符、移動先が不明な場合の遮断と絶対パスによる復帰を追加。Gitの変更操作は実行せず、文字列の判定だけを検証する。
- 検証: `npm ci`成功。`node_modules/.bin/vitest run scripts/guard-shared-checkout.test.mjs`成功（29件）。Node 26.8.1で`npm run typecheck`、`npm test`（変更途中の276件）、`npm run build`、`npm run check:dist`成功。Node 24.21.0で型検査成功。通常の`npm test`は既存の`PDF worker > keeps a dense one-million-cell PDF compact`が18.53秒で15秒制限を超え、1件失敗（276件成功）。`npm test -- --maxWorkers=1`で再実行し、全277件成功。続く`npm run build`、`npm run check:dist`も成功。実行環境を固定した正確なコマンドは下記。`git diff --check`成功。E2Eはsandboxでブラウザーを起動できないため検証担当に依頼する。iOSコード・共有コードは変更しておらず、iOSのローカル検証は対象外。PR CIの該当チェックは未実行。
- デプロイ影響: none。Web/iOSの実行時の挙動や配信内容は変わらない。配信後の追加確認は不要。

Node 24で実行したコマンド:

```sh
npm --cache /private/tmp/g16-node24-npm-cache exec --yes --package=node@24 -- sh -c 'node --version && npm run typecheck && npm test && npm run build && npm run check:dist'
npm --cache /private/tmp/g16-node24-npm-cache exec --yes --package=node@24 -- sh -c 'npm test -- --maxWorkers=1 && npm run build && npm run check:dist'
```

最初のコマンドはテスト1件失敗で終了し、後続のbuild/check:distは実行されなかった。2つ目は全て成功した。Node 24取得用の最初の`npx --yes --package=node@24 -c 'node --version && npm run typecheck && npm test && npm run build && npm run check:dist'`は既定npmキャッシュへの書き込みがEPERMで失敗したため、一時キャッシュを指定して実行した。一時キャッシュは削除済み。
