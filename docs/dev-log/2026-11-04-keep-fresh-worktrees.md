# 2026-11-04 — 作りたてのworktreeを片付けで消さない

- 影響: `npm run clean:worktrees -- --apply`が、別のセッションが`origin/main`から作った直後でまだコミットの無いworktreeとブランチを、先端が`origin/main`に含まれるという理由で消していた。作ったセッションがその瞬間worktreeの中で動いていなければ、「使用中」の判定でも守られなかった。作成から7日以内のworktree・ブランチは、マージ済み・クローズ済みのPRが先端を含む場合を除いて残すようにした。PRがあっても先端を含まなければ、同じ名前の古いブランチのPRとみなして残す。作成時刻は、worktreeは`.git/worktrees/<name>/commondir`の更新時刻（作成時に一度だけ書かれる。Claudeデスクトップアプリが作るworktreeとブランチにはreflogが無いため）、ブランチはreflogの最も古い項目から取り、古いworktreeの中で作った新しいブランチも作りたてとして扱う。作成時刻が分からないもの（reflogの無いブランチだけのもの）と7日を過ぎたものは、今までどおり判定する。マージ済みPRのworktree・ブランチは今までどおり消す。
- 主なファイル: `scripts/clean-worktrees.mjs`、`scripts/clean-worktrees.test.mjs`、`AGENTS.md`
- テスト: `decide`に、作りたてを残す・同名の古いPRがあっても残す・マージ済みPRが先端を含めば作りたてでも消す・7日を過ぎたものや作成時刻の分からないものは今までどおり消す、のケースを追加。reflogの読み取りと経過時間の表示の単体テストを追加。実リポジトリを使うテストに、`origin/main`から作った直後のworktreeが`--apply`でも残る、ワークツリーの無いブランチは新しいものだけ残る、マージ済みPRのheadが先端のworktreeとブランチは作りたてでも消える、のケースを追加し、既存の入れ子worktreeのテストは`commondir`の時刻を古くして従来の判定を確かめるようにした。
- 検証: `npm test -- scripts/clean-worktrees.test.mjs`（24件成功）。`origin/main`から一時的なworktreeを作り、`npm run clean:worktrees`（--applyなし）で`keep ... created 0m ago and has no PR yet`と表示されることを確かめて消した。`npm run typecheck`と`npm test`（80ファイル・1012件成功）。Webのソース・共有コード・ビルド設定には触れていないので、`npm run build`、`npm run check:dist`、`npm run test:e2e`は手元で実行せず、PRのCIに任せた。
- デプロイ影響: なし（リポジトリ管理用のスクリプトと文書のみ）。
