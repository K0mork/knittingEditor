# 2026-10-22 — 文書の重複・置き場所・分離・リンクを整理する

- 影響: 文書の構成を整理した。アプリとWebの挙動、ビルド、CIは変えていない。
  - 同じ文でほぼ5か所にあったCIの説明は、`docs/ARCHITECTURE.md`の「ビルドと公開」だけに残し、ほかはリンクにした。オフラインで外部を開いてよいリンクの例外は`ios/SPECIFICATION.md`の3章を正本にした。`ios/AGENTS.md`と`ios/DEVELOPMENT.md`の開発ログ・Issue・コミット・GitHub運用の規則は、ルートの`AGENTS.md`と重なる部分をリンクにし、iOSだけの規則を残した。
  - `ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`にあった日付ごとの実施記録と、`ios/docs/APP_STORE_CHECKLIST.md`のチェック欄にあった長い証跡を、新しい`ios/docs/RELEASE_VERIFICATION_RECORDS.md`へ移した。チェックリストにはチェック欄・手順・判定だけを残し、「実施前の固定情報」は記録する項目の表にした。M0〜M6の番号の意味も書いた。
  - リポジトリ全体に関わる`ios/docs/WEB_SYNC.md`を`docs/WEB_SYNC.md`へ移した。表に入っていた挙動の仕様（色の選択、地の色、編み図の一覧、書き出しを勧める帯、外観）と、`ios/docs/NATIVE_BRIDGE.md`にあったApp Storeの評価の依頼は`ios/SPECIFICATION.md`の2章へ移した。UIテスト用のDEBUG設定とCIの待ち方の手順は`ios/DEVELOPMENT.md`の「9. テスト戦略」へ移した。
  - Apple Developer Programへの加入の経過はIssue #17に任せ、手順書とチェックリストからは外した。`APP_STORE_METADATA.md`の「申請前確認」は提出チェックリストへまとめた。
  - 古い記述を直した（`ios/README.md`の「初期スケルトン」、カタログv3・26記号の基準、未定義の「フェーズ0〜1」と「M3では」、実機ゲートM0の「26記号」、旧下書きのスクリーンショットの撮り直しの記述）。`SIMULATOR_PERFORMANCE_BASELINE.md`には統合前の記録である旨を足した。
  - ルートの`README.md`と`ios/README.md`に文書の一覧を足し、`ios/docs/`内のファイル参照を同じディレクトリからの相対リンクにそろえた。`ios/AGENTS.md`に直接書かれていた手元のパスを`~/Library/…`にした。
  - `vite.config.ts`と`ios/App/ReviewRequest.swift`のコメントにある文書の場所を、移した先に直した（コードの変更はない）。
- 主なファイル: `docs/ARCHITECTURE.md`、`docs/WEB_SYNC.md`、`ios/AGENTS.md`、`ios/DEVELOPMENT.md`、`ios/SPECIFICATION.md`、`ios/README.md`、`ios/docs/REAL_DEVICE_RELEASE_CHECKLIST.md`、`ios/docs/RELEASE_VERIFICATION_RECORDS.md`、`ios/docs/APP_STORE_CHECKLIST.md`、`ios/docs/NATIVE_BRIDGE.md`、`README.md`
- テスト: 追加・更新なし。
- 検証: `ios/scripts/check-app-store-docs.sh`、`node scripts/check-pr-smoke-ui-tests.mjs`、`npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e`、`xcodegen generate --spec ios/project.yml`（プロジェクトに差分なし）、iOS Simulator向けのDebugビルドを実行した。Markdown内の相対リンクと見出しへのリンクが全部たどれることを、一時スクリプトで確かめた。差分をCodexにも読ませ、失われた規則・壊れた参照の指摘（履歴改変とリモートブランチ削除の制限、審査端末でのプライバシーポリシーの表示、節の位置など）を直した。ローカルのNode.jsは26.8.1で、24ではない。iPhone・iPadのテストはPRのCIに任せた。
- デプロイ影響: なし（`vite.config.ts`の変更はコメントだけで、配信物は変わらない）。マージ後は`deploy`と`smoke`の成功を確かめる。
