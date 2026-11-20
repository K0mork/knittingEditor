import { appUpdateFixture } from '@knitting-editor/editor-core/storage/appUpdateFixtureData';

/**
 * アプリ更新確認（#446）用。DEBUG bundleだけが動的importする。
 * 既存文書があるときは何も足さないので、利用者のデータは変更しない。テストの再試行で
 * fixtureが既に入っている場合も、ここで何もせずそのまま使う。
 *
 * 書き込みは、利用者が編み図を作って保存するときに編集画面が呼ぶのと同じ公開APIを使う
 * （新規作成の`createDocument`、自動保存の`saveDocument`、ブロック保存の`saveBlock`、
 * 切り替え時の`activeDocumentId`の設定）。保存の記録を手作りすると、本物の保存経路と
 * 形が変わって drift する恐れがあるため。公開APIには複数の記録を1トランザクションで
 * 書く作成経路が無いので、初期化より前のここで順に書く。競合する書き込みは無く、
 * 上の既存文書の確認で再試行の安全だけ保つ。
 */
export async function seedAppUpdateFixture(): Promise<void> {
  const { listDocuments, createDocument, saveDocument, saveBlock, setSetting } =
    await import('@knitting-editor/editor-core/storage/database');
  if ((await listDocuments()).length) return;
  const { documents, block } = appUpdateFixture();
  let primaryId: string | undefined;
  for (const { name, board, backgroundColor } of documents) {
    // 編み図の新規作成と同じ作成。記録のid・作成日時と、開く編み図の設定の書き込みを含む。
    const created = await createDocument(name, board.rows, board.cols);
    // 自動保存と同じ書き込み。地の色も、編集画面が保存時に必ず渡す形で渡す。
    await saveDocument({ ...created, backgroundColor }, board);
    primaryId ??= created.id;
  }
  // 画面の「選択範囲をブロックに保存」と同じ書き込み。
  await saveBlock(block);
  // 一覧から最初の編み図へ切り替えたときと同じ設定の書き込み。起動時に最初の編み図が開く。
  if (primaryId) await setSetting('activeDocumentId', primaryId);
}
