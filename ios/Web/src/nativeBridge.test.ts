import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NATIVE_EXPORT_FINISHED_EVENT, listenNativeBackupSelected, notifyNativeReady, requestNativeBackupOpen, saveBlobWithNativeBridge,
} from './nativeBridge';

function finishNativeExport(detail: unknown) {
  window.dispatchEvent(new CustomEvent(NATIVE_EXPORT_FINISHED_EVENT, { detail }));
}

/** 書き出しを送り、送ったメッセージの要求IDと結果を返す。 */
async function startNativeExport(postMessage = vi.fn()) {
  window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };
  const outcome = await saveBlobWithNativeBridge(new Blob(['abc'], { type: 'application/gzip' }), 'chart.knit');
  const id = (postMessage.mock.calls.at(-1)?.[0] as { id?: string } | undefined)?.id ?? '';
  return { outcome, id };
}

/** 未解決なら`'pending'`になる。 */
async function settled<T>(promise: Promise<T>): Promise<T | 'pending'> {
  return Promise.race([promise, new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 0))]);
}

afterEach(() => {
  delete window.webkit;
});

describe('native bridge', () => {
  it('falls back when the app message handler is absent', async () => {
    await expect(saveBlobWithNativeBridge(new Blob(['test'], { type: 'text/plain' }), 'test.txt')).resolves.toBeUndefined();
    expect(requestNativeBackupOpen()).toBe(false);
  });

  it('posts a typed binary export message', async () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };
    await expect(saveBlobWithNativeBridge(new Blob(['abc'], { type: 'application/pdf' }), 'chart.pdf')).resolves.toBeDefined();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      version: 1, type: 'exportFile', filename: 'chart.pdf', mimeType: 'application/pdf', dataBase64: 'YWJj',
    }));
    // Swift側の`NativeBridgeMessage.exportRequestID`が受け付ける形。
    expect(postMessage.mock.calls[0][0].id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it('resolves the export outcome when native code reports that the file was saved or shared', async () => {
    const { outcome, id } = await startNativeExport();
    expect(await settled(outcome!.saved)).toBe('pending');

    finishNativeExport({ id, saved: true });
    await expect(outcome!.saved).resolves.toBe(true);
  });

  it('resolves false when the save screen, share sheet or confirmation alert is cancelled', async () => {
    const { outcome, id } = await startNativeExport();
    finishNativeExport({ id, saved: false });
    await expect(outcome!.saved).resolves.toBe(false);
  });

  it('matches each result to its own request and ignores unknown or malformed results', async () => {
    const postMessage = vi.fn();
    const first = await startNativeExport(postMessage);
    const second = await startNativeExport(postMessage);
    expect(first.id).not.toBe(second.id);

    finishNativeExport({ id: 'export-from-a-reloaded-page', saved: true });
    finishNativeExport({ id: first.id });
    finishNativeExport('not an object');
    finishNativeExport({ id: 1, saved: true });
    finishNativeExport({ id: second.id, saved: false });

    await expect(first.outcome!.saved).resolves.toBeUndefined();
    await expect(second.outcome!.saved).resolves.toBe(false);
    // 同じIDの結果が重ねて届いても、最初の結果を変えない。
    finishNativeExport({ id: second.id, saved: true });
    await expect(second.outcome!.saved).resolves.toBe(false);
  });

  it('falls back when posting the export fails', async () => {
    const { outcome } = await startNativeExport(vi.fn(() => { throw new Error('closed'); }));
    expect(outcome).toBeUndefined();
  });

  it('notifies native code after the WebView bridge is ready', () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };
    expect(notifyNativeReady()).toBe(true);
    expect(postMessage).toHaveBeenCalledWith({ version: 1, type: 'webReady' });
  });

  it('receives an app-selected backup through a validated custom event', () => {
    const listener = vi.fn();
    const remove = listenNativeBackupSelected(listener);
    window.dispatchEvent(new CustomEvent('knittingEditorNativeBackupSelected', {
      detail: { filename: 'chart.knit', dataBase64: 'H4sI' },
    }));
    expect(listener).toHaveBeenCalledWith({ filename: 'chart.knit', dataBase64: 'H4sI' });
    remove();
  });
});
