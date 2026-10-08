# 2026-10-08 — iOS版で.knitの書き出しを取りやめたら最後のバックアップとして記録しない

- 影響: iOS版の「最後のバックアップ」は、これまで書き出しを始めた日時だった。確認アラートの「キャンセル」、保存画面のキャンセル、共有シートの取り消しでも記録され、書き出しを勧める帯も消えていた。ネイティブの保存画面・共有シートの結果をWebへ返し、保存・共有を終えたときだけ記録するようにした（#122）。取りやめたときは日時が変わらず、帯も残る。
  - Webは`exportFile`に要求ID（`id`）を付けて送る。メッセージは`version: 1`のままで、`id`の無い`exportFile`も受け付ける（結果は返さない）。形の合わない`id`は拒否する。
  - Swiftは書き出しを終えたら`knittingEditorNativeExportFinished`イベントで`{ id, saved }`を1回返す。保存を終えた（`didPickDocumentsAt`）・共有を終えた（`completed`が真）なら`true`、確認アラートの「キャンセル」・保存画面のキャンセル（下へスワイプを含む）・共有シートの取り消しなら`false`。保存画面を出せない・一時ファイルを用意できない・メッセージを検証できない・結果の前に次の書き出しが届いたときも`false`を返し、Webが待ち続けないようにした。
  - 要求を送った文書が別の文書へ置き換わったとき（同梱ページの読み直しなど）は、Swiftが要求IDを捨てて新しい文書へ古い結果を送らない。Webは知らないIDの結果を捨て、`saved`が真偽値でない結果は不明として扱う。
  - Swiftの書き出し中の状態（一時ファイル・MIME種別・要求ID）を`PendingExport`へまとめ、終わり方ごとに`finishPendingExport(saved:)`で一時ファイルの削除・結果の返送・評価の依頼の判定を行う。「ファイルに保存」「共有」を選んだ後に保存画面を出せなかったとき、一時ファイルが残っていたのも直した。
  - PNG・PDFも同じ経路で結果を返す。評価の依頼（#84）の判定はこれまでどおり保存・共有を終えたときだけ行う。
  - 使い方ページ（iOS）の文言を「最後に書き出した日時（保存の確認・「ファイルに保存」・共有を途中で取りやめた場合は記録しません）」に改めた。共有コードはコメントだけを直し、Web版の動作は変わらない。
- 主なファイル: `ios/App/WebViewContainer.swift`、`ios/App/NativeBridgeMessage.swift`、`ios/Web/src/nativeBridge.ts`、`ios/Web/src/platform.ts`、`ios/Web/public/guide/index.html`、`ios/docs/NATIVE_BRIDGE.md`、`ios/docs/WEB_SYNC.md`、`packages/editor-core/platform.ts`（コメント）、`packages/editor-core/ui/useEditorController.ts`（コメント）
- テスト:
  - Swift: `NativeExportResultTests`を追加。`id`の受け付け・省略・拒否、検証に失敗した書き出しからの`id`の取り出し、イベントのスクリプト、保存画面の保存・キャンセル、共有シートの完了・取り消し、確認アラートの「キャンセル」で返す結果と一時ファイルの削除、`id`の無い書き出し、文書の置き換え後に結果を返さないこと、WKWebViewのページへイベントが届くこと。`NativeBridgeMessageTests`を新しい`exportFile`の形に合わせた。
  - iOS Web: `nativeBridge.test.ts`に要求IDの形、保存・取りやめの結果、要求ごとの対応付けと不正な結果の扱い、送れなかったときのフォールバックを追加。`platform.test.ts`を追加し、`iosPlatform.saveFile`が結果を`saved`として返すことと、ブリッジが無いときのダウンロードを確かめる。`backupInterchange.test.ts`を新しい戻り値に合わせた。
- 検証:
  - iOS Web: `../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`、`../../node_modules/.bin/vitest run --config vite.config.ts`（`ios/Web`で実行）。成功（7ファイル・30件）。
  - Web: `npm run typecheck`、`npm test`、`npm run build`、`npm run check:dist`、`npm run test:e2e`。すべて成功（`npm test`は34ファイル・221件、e2eはchromium-desktop・chromium-mobile・webkit-mobileで119件成功、iPhone Safari向けの4件はChromiumで想定どおりスキップ）。`npm test`は、Simulatorのビルドと同時に流した1・2回目で、時間の上限を持つ性能テスト（100万マスのPDF、1000×1000のサムネイル）が負荷で落ちた。今回の変更と関係しない箇所で、ビルドを終えてから流し直すと全件成功した。
  - iOS: `xcodegen generate`、`xcodebuild test -only-testing:knittingEditorTests`（iPhone 17 Simulator、iOS 27.0、Xcode 27.0）。成功（77件、うち追加12件。機内モードの1件は条件付きでスキップ）。
  - SimulatorのUIテストを含む全体、アプリ更新テスト、Release Archive、同梱物の検査はPRのCIに任せた。
- デプロイ影響: Pagesへ配信されるのは共有コードのコメントの変更だけで、Web版の動作は変わらない。iOS版は次のビルドから。実機で、`.knit`の書き出しを確認アラート・保存画面・共有シートで取りやめても「最後のバックアップ」が変わらず帯が残ること、保存・共有を終えたら記録されることを確かめる。
