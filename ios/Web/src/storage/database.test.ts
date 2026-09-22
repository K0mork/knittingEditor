import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { saveBlobWithNativeBridge } from '../nativeBridge';
import { createDocument, exportBackup, importBackup } from './database';
import interopFixtureBase64 from '../../../test-fixtures/knitting-editor-v2-interop.knit.b64?raw';

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value.trim());
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

// 共通の保存・バックアップ検証は packages/editor-core/storage/database.test.ts にある。
// ここはネイティブブリッジ経由の入出力と、Web版が生成したfixtureの相互運用だけを対象にする。
describe('native backup interchange', () => {
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

  it('restores the committed Web interchange fixture', async () => {
    const fixtureBytes = decodeBase64(interopFixtureBase64);
    const result = await importBackup(new Blob([fixtureBytes.buffer as ArrayBuffer], { type: 'application/gzip' }));

    expect(result.count).toBe(1);
    expect(result.documents[0].name).toBe('相互運用fixture（復元）');
    expect(Array.from(new Uint32Array(result.documents[0].cells))).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
