import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { gzipSync, strToU8 } from 'fflate';
import { packCell } from '../model/Board';
import { STITCH_BY_KEY } from '../stitches/catalog';
import { BACKUP_LIMITS, importBackup, listDocuments } from './database';

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
