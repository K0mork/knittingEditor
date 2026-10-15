# 2026-10-15 — 編み図をまとめて削除できるようにし、削除後も一覧を開いたままにする

- 影響: Web版とiOS版の共通の編み図一覧を変えた。
  - 開いている編み図を削除すると、残りの編み図へ切り替える処理が、一覧から選んで開いたときと同じくパネルを閉じていた。続けて削除するには「編み図」を押し直す必要があったため、削除に伴う切り替えではパネルを閉じないようにした（#267）。一覧から編み図を選んで開いたときは、これまでどおり閉じる。
  - 一覧の各項目の左に、常にチェック欄を置いた。1件以上選ぶと、パネルの下端に「N件を選択中」「選択を解除」「N件を削除」のバーが出る。確認（「選んだN件の編み図を削除しますか？」）のあと、選んだ編み図を1つのトランザクションでまとめて削除する。途中で失敗したら1件も消えず、一覧も開いている編み図も変わらない。開いている編み図を含むときは残りの先頭へ切り替え、一覧は開いたままにする。編み図は最低1件残すので、全件を選ぶと「1件は残してください」と出て削除できない（#268）。1件ずつの「削除」も同じ処理を通る。
  - 「使い方」（Web版とiOS版）に、チェック欄でまとめて削除できることと、削除後も一覧が開いたままであることを書いた。
- 主なファイル: `packages/editor-core/ui/DocumentList.tsx`、`packages/editor-core/ui/useEditorController.ts`、`packages/editor-core/storage/database.ts`、`packages/editor-core/ui/documentListText.ts`、`packages/editor-core/ui/EditorView.tsx`、`packages/editor-core/styles/base.css`、`public/guide/index.html`、`ios/Web/public/guide/index.html`
- テスト:
  - Vitest（`useEditorController.test.tsx`）: 開いている編み図を削除しても一覧が開いたままで、一覧から開いたときは閉じること（修正前のコードで失敗することを確かめた）。全件を選んだときは確認を出さずに何もしないこと、確認を断ると何も消えないこと、確認すると選んだ編み図だけが消え、開いていた編み図を含むときは残りへ切り替わって一覧が開いたままであること。保存先の失敗を注入する既存のテストは、まとめて削除する`deleteDocuments`の失敗に合わせた。
  - Vitest（`DocumentList.test.tsx`）: チェック欄の読み上げ名（「〇〇を選ぶ」）、選んだ件数とバーの表示、「N件を削除」で選んだ編み図が渡ること、全件を選ぶと削除ボタンが押せないこと、一覧から消えた編み図を件数に数えないこと、「選択を解除」。
  - Playwright（`tests/e2e/document-list.spec.ts`）: 開いている編み図の削除後も一覧が開いたままであることに既存のテストを改めた。チェック欄で開いている編み図を含む2件を選び、バーが画面内にあること、確認を断ると何も消えず選択が残ること、確認すると2件が消えて残りへ切り替わり一覧が開いたままであること、最後の1件は削除できないこと、再読み込み後も消えたままであることを確かめるテストを足した。
- 検証: `npm run typecheck`、`npm test`（61ファイル、580件）、`npm run build`、`npm run check:dist`、`npm run test:e2e`（444件成功、6件は既定どおりスキップ）がすべて成功した。iOS Webは`tsc -p tsconfig.app.json --noEmit`と`vitest run --config vite.config.ts`（14ファイル、129件）が成功した。`scripts/guide-content.test.mjs`と`scripts/japanese-punctuation.test.mjs`も成功した。WebKitの狭い幅（iPhone 14）とChromiumの広い幅で画面写真を撮り、チェック欄が各項目の左に収まり、バーがパネルの下端に残ることを目で確かめた。iOSアプリの画面（Simulator・実機）は手元で確かめておらず、PRのCI（iOS Web、iPhoneのUIスモーク）と`ios-full.yml`に任せる。
- デプロイ影響: Pagesへ配信される。配信後、`https://knittingeditor.com/`で編み図を複数作り、チェック欄で選んでまとめて削除できること、開いている編み図を削除しても一覧が開いたままであることを確かめる。iOSアプリには次の同梱時に反映する。
