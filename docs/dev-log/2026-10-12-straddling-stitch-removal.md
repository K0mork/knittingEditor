# 2026-10-12 — 複数マス記号を横切る段・列の削除を修正

- 影響: Closes #157。指定位置の段・列を占める記号は、起点の位置に関係なく記号全体を除去する。通知・確認は追加しない。挿入では挿入位置より前の起点と記号の形を保ち、その位置以降の起点だけを移動するため、記号の途中を分断しない。WebとiOSの共有処理に適用する。
- 主なファイル: `packages/editor-core/model/Board.ts`。変換関数へ記号定義を渡し、削除対象と幅・高さの交差を判定する。保存形式と所有情報の再構築方法は変更しない。
- テスト: `packages/editor-core/model/BoardStructure.test.ts`に行列の削除・挿入、所有セル、範囲選択、消去、元に戻す・やり直すを追加。`packages/editor-core/storage/structureBackup.test.ts`に行列の削除・挿入後のバックアップ往復を追加。`tests/e2e/straddling-stitch-removal.spec.ts`に「盤面」→「指定位置」の行列削除・挿入後の記号数、消去、再読込を追加。
- 検証: `npm run typecheck`成功。`npm test`成功（47ファイル、453件）。`npm run build`成功。`npm run check:dist`成功。`(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`成功。`(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`成功（11ファイル、102件）。`git diff --check`成功。試行した所有情報再構築の重複除去は既存互換データのテストを壊したため撤回し、最終状態で全テストを再実行して成功した。`npm run test:e2e`（chromium-mobile、webkit-mobile、chromium-desktop）で276件成功、6件スキップ、失敗0件。追加した`straddling-stitch-removal.spec.ts`は3構成とも4件成功。追加した削除のテストは修正前のコードでは記号数が2のままになり失敗する。iOSのビルド、iPhone/iPad Simulator、更新復元、unsigned Release Archive、オフラインbundle検査はPR CIに委ねる。
- デプロイ影響: マージ後にPagesとiOSの共有盤面処理へ反映される。現時点で配信なし。配信後はHTTPSのサイトで指定位置の行列削除・挿入と消去を確認する。
