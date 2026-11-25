# 2026-11-24 — iOS Simulatorの実行を、新しく分かることがあるときに絞る

- 影響:
  - PRの`ios`ジョブ（iPhone 17 Simulator）は、`ios/`か`.github/workflows/`を変えたときだけ走らせる。共通コードだけの変更は、マージ前は`ios_web`（型検査・Vitest）までにし、Simulatorはマージ後のFull iOS validationに任せる。iOSアプリは手動でリリースするので、壊れた`main`がiOSの利用者へ届くことはない。`changes`に`ios_native`を足し、`ci-gate`は`ios_web`と`ios`を別々に必須判定する。
  - Full iOS validationに`decide`ジョブを足し、夜間は同じコミットの成功した実行があれば残りのジョブを飛ばす。判定できないときは実行する。
  - `app_update`はiPhone 17だけにした。前の版のデータが更新後に残るかは端末の形に依存しない。これでFull iOSのmacOSジョブが5つになり、同時実行枠（5台）を待たずに動く。
  - 共通コード変更時の検証時期（`docs/WEB_SYNC.md`、`ios/AGENTS.md`）、提出前に確かめる`app_update`の端末（`ios/docs/APP_STORE_CHECKLIST.md`）、PRスモークを実行する変更範囲（`ios/UITests/pr-smoke-ui-tests.txt`）の記述を、新しい条件にそろえた。
- 主なファイル: `.github/workflows/ci.yml`、`.github/workflows/ios-full.yml`、`AGENTS.md`、`ios/AGENTS.md`、`docs/ARCHITECTURE.md`、`docs/WEB_SYNC.md`、`ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/RELEASE_RUNBOOK.md`、`ios/UITests/pr-smoke-ui-tests.txt`、`scripts/ios-workflow-gating.test.mjs`
- テスト: `scripts/ios-workflow-gating.test.mjs`を追加した。`ci.yml`の`changes`が`ios_native`を出力し、`ios`ジョブが`needs.changes.outputs.ios_native == 'true'`のときだけ走ること、`ios/`と`.github/workflows/`の変更が`ios_native=true`で`packages/`は立てないこと、`ios-full.yml`の`ios_full`・`app_update`・`release_archive`が`needs: decide`と`needs.decide.outputs.run == 'true'`を持ち、`decide`が夜間だけを同じコミットの成功runで飛ばすことを、ワークフローをテキストとして読んで確かめる。
- 検証:
  - 2つのワークフローのYAMLを`ruby -ryaml`で読めることを確かめた。
  - `changes`の判定を抜き出して流し、`packages/`と`package-lock.json`では`ios_native=false`、`ios/`のSwiftと`ios/Web`とワークフローでは`true`、Markdownでは何も立たないことを確かめた。
  - `decide`の本文を偽の`gh`で流し、夜間で成功済みのときだけ`run=false`、それ以外（push・手動・未検証・APIの失敗）は`run=true`になることを確かめた。
  - `npm test -- scripts/playwright-artifacts.test.mjs scripts/ios-full-failure.test.mjs`が成功した。
  - 実際の動き（共通コードだけのPRで`ios`が飛ぶこと、Full iOSが5ジョブで動くこと、夜間が飛ぶこと）は、PRのCIとマージ後の実行で確かめる。
  - 検証（レビュー後の修正）: `node scripts/check-pr-smoke-ui-tests.mjs`（PRスモーク11件・実機14件）、`sh ios/scripts/check-app-store-docs.sh`（`App Store documents are structurally valid`）、`ruby -ryaml`による2つのワークフローの読み込み、`node --check scripts/ios-workflow-gating.test.mjs`、`git diff --check`を実行した。`npx vitest run scripts/ios-workflow-gating.test.mjs scripts/ios-full-failure.test.mjs scripts/playwright-artifacts.test.mjs scripts/check-pr-smoke-ui-tests.test.mjs`が4ファイル49件で成功した。
- デプロイ影響: なし。`web`・`deploy`・`smoke`は変えていない。マージ後に、Full iOSが5ジョブで動くことと、次の夜間が検証済みのコミットなら飛ぶことを確かめる。
