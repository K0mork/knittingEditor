# 2026-10-12 — 保存競合を別の編み図へ退避し、復元可能なバックアップと元の更新順を保つ

- 対応Issue: Closes #160、Closes #163、Closes #187。
- 影響: Web・iOS共通の保存で、読み込んだ更新日時と端末内の記録を同一トランザクションで比較する。他のタブによる更新・削除があれば、新しいIDの「（別のタブの編集）」へ保存して開き、短い通知を出す。保存・名前変更の更新日時は最低1ms進め、同時刻の保存も判定できるようにした。重複した削除は既存の冪等な処理を維持する。
- 影響: 自動保存のタイマーは、描画時点の記録ではなく最新の記録と盤面（ref）を読んで保存する。名前変更の反映も再描画を待たずにrefへ入れる。保存完了から再描画までの間にタイマーが発火しても、1つのタブで「（別のタブの編集）」が作られない。
- 影響: バックアップの圧縮処理で復元と同じ件数・解凍後サイズ・圧縮後サイズ・ブロック数・記号数の上限を確認する。超過時はファイル保存とバックアップ日時の記録に進まず、個別書き出しか不要な編み図の削除を案内する。編み図の作成・複製は制限しない。
- 影響: 復元は元の有限な`updatedAt`を保持し、日時のない旧形式や不正な値だけ復元日時を使う。`createdAt`は従来どおり復元日時にし、復元直後に「この編み図はまだバックアップしていません。」の勧めが出ないようにした。新しいIDで追加し、名前の「（復元）」は常に付ける。同じ更新日時は名前・作成日時・IDの順で並べ、保存後の一覧にも同じ比較を使う。
- 主なファイル: `packages/editor-core/storage/database.ts`、`backupCodec.ts`、`documentOrder.ts`、`packages/editor-core/state/useEditorSession.ts`、`packages/editor-core/ui/useEditorController.ts`。
- テスト: 新規の`storageConflicts.test.ts`、`backupLimits.test.ts`、`restoreDates.test.ts`、`useEditorSessionConflicts.test.tsx`、`backupLimitNotification.test.tsx`。保存競合・削除後の保存・同時保存・名前変更・履歴の維持・500/501件・元データとバックアップ日時の保護・圧縮前後の厳密なサイズ境界・最大盤面51件の事前拒否・元の更新日時と復元時刻の作成日時・同時刻の順序を検証した。サイズの厳密な1バイト境界は同じ上限定数をテスト中だけ縮め、実際のUTF-8化・圧縮・復元で検証した。
- テスト: `useEditorSessionConflicts.test.tsx`に、保存完了を描画する前に予約済みの自動保存タイマーが発火しても競合扱いにならないことを追加した。タイマーの修正を外すと失敗することを確認した。`restoreDates.test.ts`に、古い編み図を復元した直後はバックアップの勧めの条件（`backupReminderKind`）を満たさないことを追加した。
- テスト: `tests/e2e/storage-conflicts.spec.ts`を新規追加。共通IndexedDBを使う2ページの保存競合、削除後の保存、全データ復元後と再読み込み後の一覧順、IndexedDBへ直接入れた501件で「全データ」を押すと上限の案内が出てダウンロードが起きないことを検証する。
- 検証（Node v24.21.0）: `npm run typecheck`、`npm run build`、`npm run check:dist`、`(cd ios/Web && ../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit)`、`(cd ios/Web && ../../node_modules/.bin/vitest run --config vite.config.ts)`（11ファイル・102件）が成功した。
- 検証（Node v24.21.0）: 負荷の高い状態（load average 300以上）で`npm test`を実行すると、新しい`backupLimits.test.ts`の500件の往復テストが既定の5秒を超えて失敗したため、このテストに20秒の上限を付けた（単独では約0.6秒）。同じ負荷では、変更していない`thumbnail.test.ts`（1000×1000）、`pdf.worker.test.ts`（100万セル）、`BackupReminderBar.test.tsx`の時間上限を超えることがあった。これらの上限や設定は変更していない。上限を付けたあと、`npm test`は50ファイル・454件すべて成功した。
- 検証（Node v24.21.0）: `npx playwright test tests/e2e/storage-conflicts.spec.ts --repeat-each 3`は36件すべて成功した（chromium-mobile・webkit-mobile・chromium-desktop × 4テスト × 3回）。
- 検証（Node v24.21.0）: `npm run test:e2e`（chromium-mobile・webkit-mobile・chromium-desktop）は276件成功・6件スキップ・失敗0件だった。
- 検証: 最初の実装の検証で、WebKit 390pxとChromium 1440pxの画面写真により、競合時の退避名と通知、再読み込み後の一覧、復元一覧の並びと日時、上限超過の案内を目視確認した。作成日時の扱いを直したあと、同じ2つの幅で、7日より古い編み図を含む全データを復元した直後・最も古い編み図を開いたとき・再読み込み後に、バックアップの勧めの帯が出ないことを画面写真で確認した。写真はコミットしていない。
- 未実行: iPhone・iPadのビルド・Simulator/UIテスト、XcodeGen、アプリ更新、unsigned Release Archive、オフライン同梱物検査はPR CIで確認する。Swiftは変更していない。
- デプロイ影響: マージ後にPagesとiOS同梱Webへ反映される。配信後はHTTPSのWebで2タブの競合通知・退避後の再編集・削除したIDの非復活・バックアップ上限の案内・復元一覧の更新順と復元直後に勧めが出ないことを確認する。iOSでも個別／全データの書き出しと復元日時を確認する。今回、配信は行っていない。
