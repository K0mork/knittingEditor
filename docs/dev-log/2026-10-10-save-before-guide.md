# 2026-10-10 — 使い方へ移る前に最新の編集の保存を確認

- 影響: WebとiOSで「使い方」を押したとき、保存結果が `saved` または `idle` の場合だけ移動する。`failed`、`pending`、2秒のタイムアウトでは編集画面を残し、理由と次の操作を通知する。保存待ちは通知し、待機中の重複操作は保存を重ねて始めない。iOSの画面リンク、フッター、ネイティブメニューは同じ処理を使う。対応Issue: Closes #161、Closes #186。
- 主なファイル: `src/App.tsx`、`ios/Web/src/App.tsx`、`packages/editor-core/ui/guideNavigation.ts`、`packages/editor-core/package.json`、`packages/editor-core/ui/EditorView.tsx`、`packages/editor-core/state/useEditorSession.ts`。即時保存直後の離脱確認は再描画前でも最新の未保存状態を参照する。Webで新しいタブを開く修飾キー付きの操作は従来どおりとする。
- テスト: 共通の遷移処理、Webホスト、iOSのリンクとメニューに保存結果・タイムアウトを注入したVitestを追加。保存完了前の待機、再試行、重複操作、遅れて完了した保存による遷移の防止を検証。保存直後の `beforeunload` の回帰テストを追加。Playwright `tests/e2e/save-before-guide.spec.ts` は390px・1280pxで編集直後の遷移と復帰後のセル数、保存失敗時の画面維持を検証。XCUITest `testGuideNavigationReturnsToUsableEditor` はセルを置いて使い方から戻った後にセルが残ることを追加検証する。
- 検証:
  - `npm ci`: 成功。
  - `npm run typecheck`: 成功。
  - `npm test`: 既存の変更していない処理時間上限テストが失敗。初回は `thumbnail.test.ts` の1件、再実行では同じ1件と `pdf.worker.test.ts` の1件が失敗。それ以外は成功。
  - `npm test -- --maxWorkers=1`: 270件成功、上記2件の処理時間上限テストが失敗。閾値や対象コードは変更していない。
  - `npx vitest run src/App.guide.test.tsx packages/editor-core/ui/guideNavigation.test.ts packages/editor-core/state/useEditorSession.test.tsx`: 25件成功。
  - `npm run build`: 成功。
  - `npm run check:dist`: 成功。
  - `(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`: 成功。
  - `(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`: 44件成功。
  - `npx playwright test tests/e2e/save-before-guide.spec.ts --list`: 成功、3プロジェクト計9テストを認識。ブラウザ実行ではない。
  - `git diff --check`: 成功。
  - ブラウザとSimulatorを起動できないsandboxのため、PlaywrightのChromium・WebKit実行、iPhone・iPadのXCUITest、画面写真は検証担当へ引き継ぐ。iOSのXcodeGen・ビルド、Simulator全体、アプリ更新、unsigned Release Archive、オフライン同梱物検査はPRのCIに任せる。Web全体テストの上記2件も検証担当・PRのCIで再確認する。
- デプロイ影響: マージ後はPagesの編集画面へ配信され、iOSの次回ビルドにも反映される。配信後はHTTPSのサイトで編集直後に使い方へ移って戻り、最後のセルを確認する。タブ破棄・再読み込みによる消失はこの修正の対象外で、実機Safariで別に確認する。
