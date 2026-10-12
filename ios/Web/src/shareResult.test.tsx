import 'fake-indexeddb/auto';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { createDocument, getLastBackupAt } from '@knitting-editor/editor-core/storage/database';
import App from './App';
import { NATIVE_EXPORT_FINISHED_EVENT } from './nativeBridge';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function waitUntil(condition: () => boolean) {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  }
  expect(condition()).toBe(true);
}

describe('native share result in the editor', () => {
  it.each(['completed', 'cancelled', 'error'] as const)('%s controls the notice and backup date', async (status) => {
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const chart = await createDocument(`share-${status}`);
    const postMessage = vi.fn();
    window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const click = async (label: string) => {
      const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);
      expect(button).toBeDefined();
      await act(async () => { button!.click(); });
    };
    try {
      await act(async () => root.render(<App />));
      await waitUntil(() => container.querySelector('.app-shell') !== null);
      await click('保存');
      await click('この編み図');
      await waitUntil(() => postMessage.mock.calls.some(([message]) => message.type === 'exportFile'));
      const { id } = postMessage.mock.calls.find(([message]) => message.type === 'exportFile')![0];
      const finish = () => window.dispatchEvent(new CustomEvent(NATIVE_EXPORT_FINISHED_EVENT, {
        detail: { id, saved: status === 'completed', status },
      }));
      await act(async () => { finish(); finish(); });
      if (status === 'completed') {
        let recorded: number | undefined;
        await waitUntil(() => { void getLastBackupAt(chart.id).then((value) => { recorded = value; }); return recorded !== undefined; });
        expect(recorded).toBeGreaterThan(0);
      } else {
        expect(await getLastBackupAt(chart.id)).toBeUndefined();
      }
      expect(container.textContent?.includes('共有に失敗しました。もう一度共有を試してください。')).toBe(status === 'error');
    } finally {
      await act(async () => root.unmount());
      container.remove();
      canvas.mockRestore();
      delete window.webkit;
    }
  });
});
