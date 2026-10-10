# 2026-10-10 — 共有checkout保護フックでcd後の作業場所を追跡

- 影響: Claude Codeの保護フックで、worktreeから`cd`でメインへ移ったGit操作を止め、メインからworktreeへ移った操作を許可する。Closes #165。
- 主なファイル: `scripts/guard-shared-checkout.mjs`、`scripts/guard-shared-checkout.test.mjs`。
- 技術的な判断: 引用符・エスケープを含むリテラルの`cd`、`&&`・`;`・改行、subshellと波括弧を追跡し、相対的な`git -C`もその時点の場所から解決する。subshell終了後は親の場所に戻す。変数・コマンド置換・glob・チルダ展開、省略した移動先や`cd -`、`||`・pipeline・backgroundで場所が確定しない場合は、メインの可能性があるため禁止対象の操作を保守的に止める。読み取り操作は許可し、pipeline内の絶対パスの`cd`では不明状態を解除しない。pipeline外の後続の絶対パスで場所が確定すれば通常の判定に戻す。シェル自体や移動は実行しない。完全なシェル解析ではなく、リテラルの`cd`は成功した場合の場所を追跡する（`;`の前の`cd`失敗など、実行時の分岐は再現しない）。
- テスト: 両方向の`cd`、複数回の相対移動、複数の`git -C`、ネストしたsubshellと親への復帰、`gh pr checkout`、引用符、移動先が不明な場合の遮断と絶対パスによる復帰を追加。pipeline右側の絶対パスcd、`;`・`&&`・改行の後続操作、括弧・波括弧内のcd、pipeline外での復帰の回帰テストを追加。Gitの変更操作は実行せず、文字列の判定だけを検証する。
- 検証: 下記の実行結果を参照。
- デプロイ影響: none。Web/iOSの実行時の挙動や配信内容は変わらない。配信後の追加確認は不要。

## 検証

- 修正後、Node 24.21.0で`npm run typecheck`、`npm test`（全37ファイル・281件）、`npm run build`、`npm run check:dist`が成功。実行コマンドは以下。

  ```sh
  npm --cache /private/tmp/g16-final-node24-cache exec --yes --package=node@24 -- sh -c 'node --version && npm run typecheck && npm test && npm run build && npm run check:dist'
  ```

- パイプの修正後の`node_modules/.bin/vitest run scripts/guard-shared-checkout.test.mjs`は33件成功。`git diff --check`成功。パイプの修正の途中ではpipelineの波括弧ケースでガード単体1件失敗、全体280件成功・1件失敗となり、型検査は成功、build/check:distは未実行だった。グループ深さを追跡して修正し、上記を再実行した。
- 初回実装時は`npm ci`成功。Node 26.8.1で型検査、全体テスト（変更途中の276件）、build/check:dist成功。Node 24.21.0の通常並列テストは既存PDF性能テストが18.53秒で15秒制限を超え、276件成功・1件失敗。`npm test -- --maxWorkers=1`で全37ファイル・277件、続くbuild/check:dist成功。初回の`npx --yes --package=node@24 -c 'node --version && npm run typecheck && npm test && npm run build && npm run check:dist'`は既定キャッシュ書き込みのEPERMで失敗し、一時キャッシュ指定で再実行した。
- 独立確認（今回のpipeline修正前、HEAD `82f5c5a`）では、Node 26.8.1の`npm run typecheck`、`npm test`（37ファイル・277件）、`node_modules/.bin/vitest run scripts/guard-shared-checkout.test.mjs`（29件）が成功。Node 24.21.0でも以下で型検査、通常並列の277件、ガード29件成功。初回のPDFタイムアウトは再現しなかった。

  ```sh
  npm --cache <一時ディレクトリ> exec --yes --package=node@24 -- sh -c 'node --version && npm run typecheck && npm test && node_modules/.bin/vitest run scripts/guard-shared-checkout.test.mjs'
  ```

- パイプの修正前の独立確認では、`gh issue view 165`、規約・スクリプト・テスト・開発ログ・PR本文の閲覧、`git diff origin/main...HEAD`で範囲と機密情報を確認。`git diff --check`、`git diff origin/main...HEAD --check`成功、開始・終了時の`git status --short`は空。
- パイプの修正前の独立確認では、`git show origin/main:scripts/guard-shared-checkout.mjs`を用いた一時コピーに対し、`node_modules/.bin/vitest run --root <一時ディレクトリ> --config <一時ディレクトリ>/vitest.config.mjs`を実行し、17件失敗・12件成功で既存回帰テストの検出力を確認。`node --input-type=module`の文字列判定でpipeline右側のcdによる保護漏れを確認し、`bash -c 'printf x | cd <worktreeの絶対パス>; pwd'`で親の場所が変わらないことを確認。実際のGit変更操作は実行していない。
- 独立確認のbuild/check:distは未実行。Chromium/WebKit E2Eも未実行で、PR CIで確認する。iOS Web型検査・テスト、Simulator・Archive等のiOS確認は実装時・独立確認とも未実行（件数なし）。iOS・共有コードは変更しておらずローカル追加検証は対象外。PR CIの該当チェックは未確認。独立確認はすべてパイプの修正より前の結果であり、修正後の確認には数えない。パイプの修正後に、指摘されたパイプ経由の2例（`printf x | cd <worktree>; git reset --hard`、`… && git commit`）が遮断され、worktreeからmainへの`cd`後の`git reset --hard`も遮断され、mainからworktreeへの`cd`後の`git commit`は許可されることを、`blockedReasons`の直接呼び出しで確かめた。
