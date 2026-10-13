import 'fake-indexeddb/auto';
import { gunzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../model/Board';
import { BACKUP_EXPORT_LIMIT_MESSAGE, BACKUP_LIMITS, encodeBackup } from './backupCodec';
import { createDocument, deleteDocument, exportBackup, getLastBackupAt, importBackup, listDocuments, recordBackup, type ChartDocument } from './database';

const originalLimits = { ...BACKUP_LIMITS };
afterEach(() => { Object.assign(BACKUP_LIMITS, originalLimits); vi.restoreAllMocks(); });

function chart(name = '境界'): ChartDocument {
  return { id: 'boundary', name, rows: 1, cols: 1, cells: new Board(1, 1).cells.buffer as ArrayBuffer, createdAt: 1, updatedAt: 2 };
}

describe('export and restore share backup limits', () => {
  it('round-trips 500 charts, rejects 501 without changing data or backup dates, and permits individual export', async () => {
    for (const document of await listDocuments()) await deleteDocument(document.id);
    const documents = [];
    for (let index = 0; index < BACKUP_LIMITS.maxDocuments; index++) documents.push(await createDocument(`境界${index}`, 1, 1));
    const blob = await exportBackup();
    const result = await importBackup(blob);
    expect(result.count).toBe(BACKUP_LIMITS.maxDocuments);
    // 復元で追加したコピーを除いて、元の500件へ戻す。
    for (const document of result.documents) await deleteDocument(document.id);
    const extra = await createDocument('501件目', 1, 1);
    await recordBackup([extra.id], 123);
    const before = await listDocuments();
    await expect(exportBackup()).rejects.toThrow(BACKUP_EXPORT_LIMIT_MESSAGE);
    expect(await listDocuments()).toEqual(before);
    expect(await getLastBackupAt(extra.id)).toBe(123);
    expect((await importBackup(await exportBackup([extra.id]))).count).toBe(1);
  }, 20_000);

  it('round-trips the exact decompressed byte boundary and rejects one byte above before compression', async () => {
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-10-12T00:00:00.000Z');
    // 同じ本番定数を一時的に縮め、境界のJSON全体を実際にUTF-8化・圧縮・復元する。
    const limit = 1024;
    const source = chart('日本語');
    const overhead = gunzipSync(encodeBackup([source], [])).byteLength;
    Object.assign(BACKUP_LIMITS, { maxDecompressedBytes: limit });
    const boundary = { ...source, name: source.name + 'x'.repeat(limit - overhead) };
    const bytes = encodeBackup([boundary], []);
    expect(gunzipSync(bytes).byteLength).toBe(limit);
    expect((await importBackup(new Blob([bytes]))).documents[0].name).toBe(`${boundary.name}（復元）`);
    expect(() => encodeBackup([{ ...boundary, name: boundary.name + 'x' }], [])).toThrow(BACKUP_EXPORT_LIMIT_MESSAGE);
    Object.assign(BACKUP_LIMITS, { maxDecompressedBytes: limit + 1 });
    const over = encodeBackup([{ ...boundary, name: boundary.name + 'x' }], []);
    Object.assign(BACKUP_LIMITS, { maxDecompressedBytes: limit });
    await expect(importBackup(new Blob([over]))).rejects.toThrow('解凍後のバックアップが大きすぎます');
  });

  it('rejects 51 maximum-sized boards before constructing their base64 JSON', () => {
    const source = { ...chart(), rows: 1000, cols: 1000, cells: new ArrayBuffer(4_000_000) };
    expect(() => encodeBackup(Array.from({ length: 51 }, (_, index) => ({ ...source, id: String(index) })), []))
      .toThrow(BACKUP_EXPORT_LIMIT_MESSAGE);
  });

  it('checks the compressed boundary as well', async () => {
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-10-12T00:00:00.000Z');
    const bytes = encodeBackup([chart()], []);
    Object.assign(BACKUP_LIMITS, { maxCompressedBytes: bytes.byteLength });
    expect((await importBackup(new Blob([encodeBackup([chart()], [])]))).count).toBe(1);
    Object.assign(BACKUP_LIMITS, { maxCompressedBytes: bytes.byteLength - 1 });
    expect(() => encodeBackup([chart()], [])).toThrow(BACKUP_EXPORT_LIMIT_MESSAGE);
  });

  it('enforces block count and total anchors before writing a file', () => {
    const block = { id: 'block', name: 'ブロック', rows: 1, cols: 1, createdAt: 1, anchors: [] };
    expect(() => encodeBackup([], Array.from({ length: BACKUP_LIMITS.maxBlocks }, () => block))).not.toThrow();
    expect(() => encodeBackup([], Array.from({ length: BACKUP_LIMITS.maxBlocks + 1 }, () => block))).toThrow(BACKUP_EXPORT_LIMIT_MESSAGE);
    Object.assign(BACKUP_LIMITS, { maxBlockAnchors: 0 });
    expect(() => encodeBackup([], [{ ...block, anchors: [{ row: 0, col: 0, value: 1 }] }])).toThrow(BACKUP_EXPORT_LIMIT_MESSAGE);
  });
});
