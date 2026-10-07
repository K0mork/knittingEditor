import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { gunzipSync, strFromU8 } from 'fflate';
import { Board } from '../model/Board';
import {
  createDocument, deleteDocument, exportBackup, getLastBackupAt, getSetting, importBackup, initializeStorage,
  lastBackupKey, recordBackup,
} from './database';

const LEGACY_ID = 'existing-before-backup-dates';

/**
 * 最後のバックアップ日時を記録する前のアプリが作ったデータを、同じDB名・同じ版で置く。
 * 日時は設定に足すだけで、DBの版も編み図の記録も変えていないことを確かめる。
 */
beforeAll(async () => {
  const request = indexedDB.open('knitting-editor-v2', 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore('documents', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
    db.createObjectStore('blocks', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
    db.createObjectStore('settings', { keyPath: 'key' });
  };
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = db.transaction(['documents', 'settings'], 'readwrite');
  transaction.objectStore('documents').put({
    id: LEGACY_ID, name: '前からある編み図', rows: 2, cols: 2,
    cells: new Board(2, 2).cells.slice().buffer, createdAt: 1_700_000_000_000, updatedAt: 1_700_000_100_000,
  });
  transaction.objectStore('settings').put({ key: 'activeDocumentId', value: LEGACY_ID });
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
});

describe('last backup dates', () => {
  it('reads existing charts without a record as never backed up', async () => {
    const initialized = await initializeStorage();
    expect(initialized.activeId).toBe(LEGACY_ID);
    expect(initialized.documents).toHaveLength(1);
    expect(Object.keys(initialized.documents[0]).sort()).toEqual(['cells', 'cols', 'createdAt', 'id', 'name', 'rows', 'updatedAt']);
    expect(await getLastBackupAt(LEGACY_ID)).toBeUndefined();
  });

  it('records one chart or every chart', async () => {
    const other = await createDocument('もう一つの編み図');
    await recordBackup([LEGACY_ID], 1_800_000_000_000);
    expect(await getLastBackupAt(LEGACY_ID)).toBe(1_800_000_000_000);
    expect(await getLastBackupAt(other.id)).toBeUndefined();

    await recordBackup(undefined, 1_800_000_500_000);
    expect(await getLastBackupAt(LEGACY_ID)).toBe(1_800_000_500_000);
    expect(await getLastBackupAt(other.id)).toBe(1_800_000_500_000);
  });

  it('keeps the dates out of .knit files and restored charts', async () => {
    const payload = JSON.parse(strFromU8(gunzipSync(new Uint8Array(await (await exportBackup()).arrayBuffer())))) as {
      documents: Array<Record<string, unknown>>;
    };
    expect(payload.documents.length).toBeGreaterThan(0);
    for (const document of payload.documents) expect(Object.keys(document)).not.toContain('lastBackupAt');
    expect(JSON.stringify(payload)).not.toContain('lastBackupAt');

    const restored = await importBackup(await exportBackup([LEGACY_ID]));
    expect(await getLastBackupAt(restored.documents[0].id)).toBeUndefined();
  });

  it('ignores a malformed record', async () => {
    const document = await createDocument('壊れた記録');
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('settings', 'readwrite');
    transaction.objectStore('settings').put({ key: lastBackupKey(document.id), value: 'not a date' });
    await new Promise<void>((resolve) => { transaction.oncomplete = () => resolve(); });
    db.close();
    expect(await getLastBackupAt(document.id)).toBeUndefined();
  });

  it('forgets the date when the chart is deleted', async () => {
    const document = await createDocument('消す編み図');
    await recordBackup([document.id], 1_800_000_900_000);
    await deleteDocument(document.id);
    expect(await getSetting(lastBackupKey(document.id))).toBeUndefined();
  });
});
