import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { Board } from '../model/Board';
import { saveBlobWithNativeBridge } from '../nativeBridge';
import {
  boardFromDocument, createDocument, exportBackup, importBackup, initializeStorage, listDocuments, saveDocument, setSetting,
} from './database';
import interopFixtureBase64 from '../../../test-fixtures/knitting-editor-v2-interop.knit.b64?raw';

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.trim());
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function backupBlob(payload: unknown): Blob {
  return new Blob([gzipSync(strToU8(JSON.stringify(payload)))], { type: 'application/gzip' });
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

  it('round-trips an app export through the native bridge payload', async () => {
    const source = await createDocument('アプリ出力fixture', 2, 3);
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };

    const backup = await exportBackup([source.id]);
    await expect(saveBlobWithNativeBridge(backup, 'アプリ出力fixture.knit')).resolves.toBe(true);

    const message = postMessage.mock.calls[0]?.[0] as { dataBase64?: string; mimeType?: string } | undefined;
    expect(message?.mimeType).toBe('application/gzip');
    const bridgedBytes = decodeBase64(message?.dataBase64 ?? '');
    const restored = await importBackup(new Blob([bridgedBytes.buffer as ArrayBuffer], { type: 'application/gzip' }));
    expect(restored.documents[0].name).toBe('アプリ出力fixture（復元）');

    delete window.webkit;
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

  it('rejects unknown stitch IDs instead of silently clearing them', async () => {
    const cells = new Uint32Array([0xff00_0001]);
    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: [{ name: '不正', rows: 1, cols: 1, cells: btoa(String.fromCharCode(...new Uint8Array(cells.buffer))) }],
      blocks: [],
    }))).rejects.toThrow('未対応の記号');
  });

  it('rejects overlapping block anchors instead of dropping malformed blocks', async () => {
    const packedKnit = (1 << 24) | 0x12_3456;
    await expect(importBackup(backupBlob({
      format: 'knitting-editor', version: 2, stitchCatalogVersion: 3,
      documents: [],
      blocks: [{
        name: '不正ブロック', rows: 1, cols: 1,
        anchors: [{ row: 0, col: 0, value: packedKnit }, { row: 0, col: 0, value: packedKnit }],
      }],
    }))).rejects.toThrow('重複');
  });

  it('restores the committed Web interchange fixture', async () => {
    const fixtureBytes = decodeBase64(interopFixtureBase64);
    const result = await importBackup(new Blob([fixtureBytes.buffer as ArrayBuffer], { type: 'application/gzip' }));

    expect(result.count).toBe(1);
    expect(result.documents[0].name).toBe('相互運用fixture（復元）');
    expect(Array.from(new Uint32Array(result.documents[0].cells))).toEqual([1, 2, 3, 4, 5, 6]);
  });

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
