import { openDB } from 'idb';
import { appUpdateFixture } from '@knitting-editor/editor-core/storage/appUpdateFixtureData';

/**
 * アプリ更新確認（#446）用。DEBUG bundleだけが動的importする。
 * 既存文書があるときは何も足さないので、利用者のデータは変更しない。テストの再試行で
 * fixtureが既に入っている場合も、ここで何もせずそのまま使う。
 */
export async function seedAppUpdateFixture(): Promise<void> {
  // 通常のschema作成を共用する。initializeStorageより前なので空のまま検査できる。
  const { listDocuments } = await import('@knitting-editor/editor-core/storage/database');
  if ((await listDocuments()).length) return;
  const db = await openDB('knitting-editor-v2');
  try {
    const tx = db.transaction(['documents', 'blocks', 'settings'], 'readwrite');
    // 同時の起動処理が文書を追加していないことも同一トランザクションで確かめる。
    if (await tx.objectStore('documents').count()) {
      tx.abort();
      return;
    }
    const fixture = appUpdateFixture();
    for (const document of fixture.documents) await tx.objectStore('documents').put(document);
    await tx.objectStore('blocks').put(fixture.block);
    await tx.objectStore('settings').put({ key: 'activeDocumentId', value: fixture.activeDocumentId });
    await tx.done;
  } finally { db.close(); }
}
