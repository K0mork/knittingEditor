import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { Board, packCell } from '../model/Board';
import { STITCH_BY_KEY, STITCH_CATALOG_VERSION } from '../stitches/catalog';
import {
  BACKUP_LIMITS, boardFromDocument, createDocument, exportBackup, importBackup, initializeStorage,
  listDocuments, saveDocument, setSetting,
} from './database';

function backupBlob(payload: unknown): Blob {
  return new Blob([gzipSync(strToU8(JSON.stringify(payload)))], { type: 'application/gzip' });
}

function packedCells(values: number[]): string {
  const cells = Uint32Array.from(values);
  return btoa(String.fromCharCode(...new Uint8Array(cells.buffer)));
}

const knitId = STITCH_BY_KEY.get('knit')!.id;
const twoWideId = STITCH_BY_KEY.get('right_up_two_one')!.id;

function documentPayload(name: string) {
  return { name, rows: 1, cols: 1, cells: packedCells([packCell(knitId, 0x12_3456)]) };
}

/**
 * 復元は壊れたデータを黙って取り込まない。Web版は以前、壊れたブロックだけを捨てて
 * 復元を続けていたため、ここでは中止される側の挙動を固定する。
 */
describe('backup validation', () => {
  it('aborts the whole restore when one block is malformed', async () => {
    const before = (await listDocuments()).length;
    const packedKnit = packCell(knitId, 0x12_3456);

    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: [documentPayload('巻き添えになる編み図')],
      blocks: [{ name: '範囲外ブロック', rows: 1, cols: 1, anchors: [{ row: 5, col: 0, value: packedKnit }] }],
    }))).rejects.toThrow('ブロックデータが破損しています');

    expect((await listDocuments()).length).toBe(before);
  });

  it('rejects a board whose multi-cell stitch runs past the edge', async () => {
    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: [{ name: 'はみ出す記号', rows: 1, cols: 1, cells: packedCells([packCell(twoWideId, 0)]) }],
      blocks: [],
    }))).rejects.toThrow('盤面データが破損しています');
  });

  it('rejects a backup that exceeds the document count limit', async () => {
    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: Array.from({ length: BACKUP_LIMITS.maxDocuments + 1 }, (_, index) => documentPayload(`編み図${index}`)),
      blocks: [],
    }))).rejects.toThrow('安全上限');
  });

  it('rejects a backup that exceeds the block count limit', async () => {
    const packedKnit = packCell(knitId, 0);
    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: [],
      blocks: Array.from({ length: BACKUP_LIMITS.maxBlocks + 1 }, (_, index) => ({
        name: `ブロック${index}`, rows: 1, cols: 1, anchors: [{ row: 0, col: 0, value: packedKnit }],
      })),
    }))).rejects.toThrow('安全上限');
  });

  it('rejects a compressed file larger than the safe limit before decompressing', async () => {
    const oversized = new Uint8Array(BACKUP_LIMITS.maxCompressedBytes + 1);
    await expect(importBackup(new Blob([oversized.buffer as ArrayBuffer]))).rejects.toThrow('大きすぎます');
  });
});

describe('backup restore', () => {
  it('round-trips the board and returns the restored document', async () => {
    const source = await createDocument('復元テスト', 3, 4);
    const board = new Board(3, 4);
    board.place(1, 2, 'knit', '#123456', false);
    await saveDocument(source, board);

    const backup = await exportBackup([source.id]);
    const payload = JSON.parse(strFromU8(gunzipSync(new Uint8Array(await backup.arrayBuffer())))) as { stitchCatalogVersion?: number };
    expect(payload.stitchCatalogVersion).toBe(3);
    const result = await importBackup(backup);

    expect(result.count).toBe(1);
    expect(result.documents[0].id).not.toBe(source.id);
    expect(result.documents[0].name).toBe('復元テスト（復元）');
    const restored = boardFromDocument(result.documents[0]);
    expect(restored.valueAt(1, 2)).toBe(board.valueAt(1, 2));
  });

  it('rejects malformed gzip data before touching IndexedDB', async () => {
    await expect(importBackup(new Blob([new Uint8Array([1, 2, 3])]))).rejects.toThrow();
  });

  it('rejects a backup from a newer stitch catalog', async () => {
    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: STITCH_CATALOG_VERSION + 1, documents: [], blocks: [],
    }))).rejects.toThrow('新しい記号カタログ');
  });

  it('rejects unknown stitch IDs instead of silently clearing them', async () => {
    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: [{ name: '不正', rows: 1, cols: 1, cells: packedCells([0xff00_0001]) }],
      blocks: [],
    }))).rejects.toThrow('未対応の記号');
  });

  it('rejects overlapping block anchors instead of dropping malformed blocks', async () => {
    const packedKnit = packCell(knitId, 0x12_3456);
    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: [],
      blocks: [{
        name: '不正ブロック', rows: 1, cols: 1,
        anchors: [{ row: 0, col: 0, value: packedKnit }, { row: 0, col: 0, value: packedKnit }],
      }],
    }))).rejects.toThrow('重複');
  });
});

describe('document persistence', () => {
  it('keeps the selected document across storage initialization', async () => {
    const first = await createDocument('先に作った編み図');
    await createDocument('後に作った編み図');
    await setSetting('activeDocumentId', first.id);

    const initialized = await initializeStorage();

    expect(initialized.activeId).toBe(first.id);
    expect(initialized.documents.map((document) => document.id)).toContain(first.id);
  });

  it('persists a 1000x1000 board and restores its packed cells', async () => {
    const document = await createDocument('最大盤面', 1, 1);
    const board = new Board(1000, 1000);
    board.place(0, 0, 'knit', '#123456', false);
    board.place(999, 999, 'purl', '#abcdef', false);

    await saveDocument(document, board);
    const stored = (await listDocuments()).find((item) => item.id === document.id);

    expect(stored).toBeDefined();
    expect(stored!.cells.byteLength).toBe(1000 * 1000 * Uint32Array.BYTES_PER_ELEMENT);
    const restored = boardFromDocument(stored!);
    expect(restored.valueAt(0, 0)).toBe(board.valueAt(0, 0));
    expect(restored.valueAt(999, 999)).toBe(board.valueAt(999, 999));
  });
});
