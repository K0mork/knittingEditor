import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenNativeBackupSelected, notifyNativeReady, requestNativeBackupOpen, saveBlobWithNativeBridge } from './nativeBridge';

afterEach(() => {
  delete window.webkit;
});

describe('native bridge', () => {
  it('falls back when the app message handler is absent', async () => {
    await expect(saveBlobWithNativeBridge(new Blob(['test'], { type: 'text/plain' }), 'test.txt')).resolves.toBe(false);
    expect(requestNativeBackupOpen()).toBe(false);
  });

  it('posts a typed binary export message', async () => {
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };
    await expect(saveBlobWithNativeBridge(new Blob(['abc'], { type: 'application/pdf' }), 'chart.pdf')).resolves.toBe(true);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      version: 1, type: 'exportFile', filename: 'chart.pdf', mimeType: 'application/pdf', dataBase64: 'YWJj',
    }));
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
