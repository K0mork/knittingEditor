import 'fake-indexeddb/auto';
import { gunzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import interopFixtureBase64 from '../../../ios/test-fixtures/knitting-editor-v2-interop.knit.b64?raw';
import { renderThumbnail, ThumbnailCache } from '../model/thumbnail';
import { STITCH_BY_KEY } from '../stitches/catalog';
import { base64ToBytes } from '../util/base64';
import { boardFromDocument, createDocument, exportBackup, importBackup, initializeStorage, listDocuments, type ChartDocument } from './database';

/**
 * 縮小画像は保存せず、保存済みのセル配列から作る。ここでは、保存形式を変えていないこと
 * （IndexedDBの記録と`.knit`の項目が以前のまま）と、以前の形式のデータからも縮小画像を
 * 作れることを確かめる。
 */
const DOCUMENT_KEYS = ['cells', 'cols', 'createdAt', 'id', 'name', 'rows', 'updatedAt'];

async function putRawDocument(record: Record<string, unknown>): Promise<void> {
  const request = indexedDB.open('knitting-editor-v2');
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('documents', 'readwrite');
    transaction.objectStore('documents').put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

function thumbnailOf(document: ChartDocument) {
  return renderThumbnail(document.rows, document.cols, new Uint32Array(document.cells));
}

describe('chart list thumbnails and stored data', () => {
  it('builds a thumbnail for a record written before thumbnails existed, with legacy cells', async () => {
    await initializeStorage();
    // 以前の版が書いた記録と同じ項目だけを持ち、セルは記号IDだけの旧形式。
    const knit = STITCH_BY_KEY.get('knit')!.id;
    await putRawDocument({
      id: 'legacy-record', name: '以前の編み図', rows: 1, cols: 2,
      cells: Uint32Array.of(knit, 0).buffer, createdAt: 1, updatedAt: 2,
    });
    const stored = (await listDocuments()).find((document) => document.id === 'legacy-record')!;
    expect(Object.keys(stored).sort()).toEqual(DOCUMENT_KEYS);
    const thumbnail = new ThumbnailCache().get(stored);
    expect(Array.from(thumbnail.pixels)).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
    // 縮小画像は盤面として読み込んだときと同じ結果になる。
    const board = boardFromDocument(stored);
    expect(thumbnail.pixels).toEqual(renderThumbnail(board.rows, board.cols, board.cells).pixels);
  });

  it('keeps the stored record and the .knit document fields unchanged', async () => {
    const created = await createDocument('項目の確認', 2, 2);
    expect(Object.keys(created).sort()).toEqual(DOCUMENT_KEYS);
    const backup = await exportBackup([created.id]);
    const payload = JSON.parse(strFromU8(gunzipSync(new Uint8Array(await backup.arrayBuffer())))) as {
      format: string; version: number; documents: Array<Record<string, unknown>>;
    };
    expect(payload.format).toBe('knitting-editor');
    expect(payload.version).toBe(2);
    expect(Object.keys(payload.documents[0]).sort()).toEqual(DOCUMENT_KEYS);
  });

  it('builds the same thumbnail for the shared Web/iOS fixture as for the board it loads into', async () => {
    const fixtureBytes = base64ToBytes(interopFixtureBase64.trim());
    const result = await importBackup(new Blob([fixtureBytes.buffer as ArrayBuffer], { type: 'application/gzip' }));
    const restored = result.documents[0];
    const board = boardFromDocument(restored);
    expect(thumbnailOf(restored).pixels).toEqual(renderThumbnail(board.rows, board.cols, board.cells).pixels);
  });
});
