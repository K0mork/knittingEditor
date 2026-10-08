import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from '@knitting-editor/editor-core/export/exporters';
import { NATIVE_EXPORT_FINISHED_EVENT } from './nativeBridge';
import { iosPlatform } from './platform';

vi.mock('@knitting-editor/editor-core/export/exporters', () => ({ downloadBlob: vi.fn() }));

afterEach(() => {
  delete window.webkit;
  vi.mocked(downloadBlob).mockClear();
});

async function exportThroughApp(saved: boolean) {
  const postMessage = vi.fn();
  window.webkit = { messageHandlers: { knittingEditor: { postMessage } } };
  const outcome = await iosPlatform.saveFile(new Blob(['abc'], { type: 'application/gzip' }), 'chart.knit');
  const { id } = postMessage.mock.calls[0][0] as { id: string };
  window.dispatchEvent(new CustomEvent(NATIVE_EXPORT_FINISHED_EVENT, { detail: { id, saved } }));
  return outcome.saved;
}

// 共有コードは`saved`が`false`のときだけ最後のバックアップ日時を記録しない（useEditorController.ts の backup）。
describe('iosPlatform.saveFile', () => {
  it('reports saved when the user finishes saving or sharing in the native screen', async () => {
    await expect(exportThroughApp(true)).resolves.toBe(true);
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('reports not saved when the user cancels the native screen', async () => {
    await expect(exportThroughApp(false)).resolves.toBe(false);
  });

  it('downloads with an unknown outcome outside the app', async () => {
    const blob = new Blob(['abc'], { type: 'application/gzip' });
    const outcome = await iosPlatform.saveFile(blob, 'chart.knit');
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'chart.knit');
    await expect(outcome.saved).resolves.toBeUndefined();
  });
});
