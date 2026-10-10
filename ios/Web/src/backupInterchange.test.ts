import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { gunzipSync, strFromU8 } from 'fflate';
import { saveBlobWithNativeBridge } from './nativeBridge';
import { Board } from '@knitting-editor/editor-core/model/Board';
import { boardFromDocument, createDocument, exportBackup, importBackup, listBlocks, saveBlock, saveDocument } from '@knitting-editor/editor-core/storage/database';
import { base64ToBytes } from '@knitting-editor/editor-core/util/base64';
import interopFixtureBase64 from '../../test-fixtures/knitting-editor-v2-interop.knit.b64?raw';

// 共通の保存・バックアップ検証は packages/editor-core/storage/database.test.ts にある。
// ここはネイティブブリッジ経由の入出力と、Web版が生成したfixtureの相互運用だけを対象にする。
describe('native backup interchange', () => {
  it('round-trips an app export through the native bridge payload', async () => {
    const source = await createDocument('アプリ出力fixture', 2, 3);
    const board = new Board(2, 3);
    board.place(0, 0, 'knit', '#c83264', false);
    board.place(1, 1, 'right_up_two_one', '#2468ac', false);
    await saveDocument({ ...source, backgroundColor: '#1e1e1e' }, board);
    const block = board.createBlock({ top: 0, left: 0, bottom: 1, right: 2 }, 'アプリの色付きブロック');
    await saveBlock(block);
    const before = await listBlocks();
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };

    const backup = await exportBackup();
    await expect(saveBlobWithNativeBridge(backup, 'アプリ出力fixture.knit')).resolves.toBeDefined();

    const message = postMessage.mock.calls[0]?.[0] as { dataBase64?: string; mimeType?: string } | undefined;
    expect(message?.mimeType).toBe('application/gzip');
    const bridgedBytes = base64ToBytes(message?.dataBase64 ?? '');
    const restored = await importBackup(new Blob([bridgedBytes.buffer as ArrayBuffer], { type: 'application/gzip' }));
    const document = restored.documents.find((item) => item.name === 'アプリ出力fixture（復元）')!;
    expect(document.name).toBe('アプリ出力fixture（復元）');
    expect(document.backgroundColor).toBe('#1e1e1e');

    expect(boardFromDocument(document).cells).toEqual(board.cells);
    const after = await listBlocks();
    expect(after).toHaveLength(before.length * 2);
    expect(after).toContainEqual(block);
    const restoredBlock = after.find((item) => item.name === `${block.name}（復元）`)!;
    expect(restoredBlock.id).not.toBe(block.id);
    expect([restoredBlock.rows, restoredBlock.cols, restoredBlock.anchors]).toEqual([block.rows, block.cols, block.anchors]);
    const pasted = new Board(2, 3);
    expect(pasted.pasteBlock(restoredBlock, 0, 0)).toBe(true);
    expect(pasted.cells).toEqual(board.cells);
    const individualBackup = await exportBackup([source.id]);
    const payload = JSON.parse(strFromU8(gunzipSync(new Uint8Array(await individualBackup.arrayBuffer()))));
    expect(payload.blocks).toEqual([]);
    const individual = await importBackup(individualBackup);
    expect(boardFromDocument(individual.documents[0]).cells).toEqual(board.cells);
    expect(await listBlocks()).toEqual(after);
    delete window.webkit;
  });

  it('restores the committed Web interchange fixture', async () => {
    const fixtureBytes = base64ToBytes(interopFixtureBase64.trim());
    const result = await importBackup(new Blob([fixtureBytes.buffer as ArrayBuffer], { type: 'application/gzip' }));

    expect(result.count).toBe(1);
    expect(result.documents[0].name).toBe('相互運用fixture（復元）');
    expect(Array.from(new Uint32Array(result.documents[0].cells))).toEqual([1, 2, 3, 4, 5, 6]);
    // 背景色を加える前のfixtureには地の色が無く、白い地の編み図として読む。
    expect(result.documents[0]).not.toHaveProperty('backgroundColor');
  });
});
