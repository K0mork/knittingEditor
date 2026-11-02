# 2026-11-03 — 入れ子のworktreeを含む親を片付けで消さない

- 影響: `npm run clean:worktrees -- --apply`は、残すと判定したworktree（未コミットの変更、オープンなPR、実行中のセッションなど）を中に入れ子で持つworktreeも、`contains the kept nested worktree <path>`という理由で残す。これまでは、入れ子のworktreeを「keep」と判定しても、親を「remove」と判定して`git worktree remove <親>`を実行していた。`.claude/`は`.gitignore`の対象なので、`git worktree remove`は入れ子のworktreeを無視されたファイルとして`--force`なしでも一緒に消し、その未コミットの変更と`.git/worktrees/`の管理情報が失われていた。2026-11-03に、マージ済みのPR #377の調査用の、コミットしない予定の変更がこれで失われた。`AGENTS.md`の「Branches, Worktrees & Cleanup」に、この動作と、手で消す前に入れ子のworktreeを確かめることを書き足した。
- 主なファイル: `scripts/clean-worktrees.mjs`、`scripts/clean-worktrees.test.mjs`、`AGENTS.md`
- テスト: `scripts/clean-worktrees.test.mjs`に`planWorktrees`のテストを3件追加した。親が削除の条件を満たし、子が未コミットの変更を持つ場合に両方が残ること、孫が使用中なら一覧の順序によらず祖先がすべて残ること、子も消す場合と、名前の前方が同じだけの兄弟（`parent`と`parent-2`）では親を消すこと。
- 検証:
  - `npm test -- scripts/clean-worktrees.test.mjs`：12テスト成功。入れ子の保護を外すと、追加したテストのうち2件が失敗することも確かめた。
  - 一時ディレクトリの使い捨てのリポジトリ（偽の`gh`と`lsof`を使う）で、detachedの親の中に未コミットの変更を持つ入れ子のworktreeを作り、`--apply`で実行した。変更前のスクリプトは親を消し、入れ子のworktreeと変更も消えた。変更後は両方が残った。子に変更が無い場合は、変更後も両方を消した。
  - このリポジトリで`npm run clean:worktrees`（`--apply`なし）を実行し、判定の表示が動くことを確かめた。
  - `npm run typecheck`、`npm test`（79ファイル・991テスト）、`npm run build`、`npm run check:dist`、`git diff --check`：すべて成功（Node v26.8.1）。
- 未実行: `npm run test:e2e`とiOSの検査。ブラウザーやアプリの挙動を変えない、リポジトリのスクリプトだけの変更のため、PRのCIの結果で確かめる。
- デプロイ影響: なし。片付けのスクリプトと文書だけの変更で、配信物は変わらない。
