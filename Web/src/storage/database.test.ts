import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { Board } from '../model/Board';
import {
  boardFromDocument, createDocument, exportBackup, importBackup, saveDocument,
} from './database';
import interopFixtureBase64 from '../../../test-fixtures/knitting-editor-v2-interop.knit.b64?raw';

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.trim());
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

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
    const backup = gzipSync(strToU8(JSON.stringify({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 4, documents: [], blocks: [],
    })));
    await expect(importBackup(new Blob([backup]))).rejects.toThrow('新しい記号カタログ');
  });

  it('restores the committed Web interchange fixture', async () => {
    const fixtureBytes = decodeBase64(interopFixtureBase64);
    const result = await importBackup(new Blob([fixtureBytes.buffer as ArrayBuffer], { type: 'application/gzip' }));

    expect(result.count).toBe(1);
    expect(result.documents[0].name).toBe('相互運用fixture（復元）');
    expect(Array.from(new Uint32Array(result.documents[0].cells))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
