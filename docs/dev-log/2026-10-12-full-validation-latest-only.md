# 2026-10-12 — iOSの全体検証は同じブランチの最新の実行だけを残す

- 影響: `Full iOS validation`（`.github/workflows/ios-full.yml`）に`concurrency`（`ios-full-<ref>`、`cancel-in-progress: true`）を足した。mainへ続けてマージすると、まだ終わっていない古い実行を取り消し、最新のコミットだけを検証する。最新のコミットはそれ以前の変更を含むので、確認の範囲は変わらない。1回の全体検証は5つのmacOSジョブを約27分使い、マージのたびに積み上がって、同時5つまでのmacOSの枠をPRのCIと取り合っていたため。`AGENTS.md`の完了確認を「マージしたコミット、またはそれを含む後のmainのコミットの全体検証」に合わせた。
- 主なファイル: `.github/workflows/ios-full.yml`、`AGENTS.md`。
- テスト: なし（CIの設定のみ）。
- 検証: `ruby -ryaml -e 'YAML.load_file(ARGV[0])' .github/workflows/ios-full.yml`が成功。`git diff`で変更が`concurrency`の追加と`AGENTS.md`の2か所だけであることを確かめた。
- デプロイ影響: なし。
