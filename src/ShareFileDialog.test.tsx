import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useShareOffer } from './ShareFileDialog';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let offer: ((file: File) => Promise<boolean | undefined>) | undefined;
let result: Promise<boolean | undefined> | undefined;

function Host() {
  const { offerShare, dialog } = useShareOffer();
  offer = offerShare;
  return <>{dialog}</>;
}

async function renderWithOffer(file: File) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(<Host />); });
  await act(async () => { result = offer!(file); });
}

const button = (name: string) => [...document.querySelectorAll('button')].find((element) => element.textContent === name)!;

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  root = undefined;
  result = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ShareFileDialog', () => {
  const file = new File(['%PDF'], '新しい編み図.pdf', { type: 'application/pdf' });

  it('opens the share sheet only when the button is tapped, then closes', async () => {
    const share = vi.fn(async (_data: ShareData) => {});
    vi.stubGlobal('navigator', { ...navigator, share });
    await renderWithOffer(file);

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('「新しい編み図.pdf」の準備ができました');
    expect(share).not.toHaveBeenCalled();

    await act(async () => { button('共有・保存').click(); });
    expect(share).toHaveBeenCalledWith({ files: [file] });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await expect(result).resolves.toBe(true);
  });

  it('closes without downloading when the share sheet is dismissed', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: async () => { throw new DOMException('cancelled', 'AbortError'); } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderWithOffer(file);

    await act(async () => { button('共有・保存').click(); });
    expect(click).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await expect(result).resolves.toBe(false);
  });

  it('falls back to a download when sharing fails', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: async () => { throw new DOMException('denied', 'NotAllowedError'); } });
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:chart', revokeObjectURL: () => {} });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderWithOffer(file);

    await act(async () => { button('共有・保存').click(); });
    expect(click).toHaveBeenCalledOnce();
    // ダウンロードは保存を終えたかが分からない。
    await expect(result).resolves.toBeUndefined();
  });

  it('closes without sharing', async () => {
    const share = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, share });
    await renderWithOffer(file);

    await act(async () => { button('閉じる').click(); });
    expect(share).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await expect(result).resolves.toBe(false);
  });

  it('treats a file replaced before sharing as not shared', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn(async () => {}) });
    await renderWithOffer(file);
    const first = result;
    await act(async () => { result = offer!(new File(['%PDF'], '次の編み図.pdf', { type: 'application/pdf' })); });

    await expect(first).resolves.toBe(false);
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('「次の編み図.pdf」の準備ができました');
  });
});
