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

function pressEscape() {
  document.querySelector('.share-dialog')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

function mouseDown(target: Element) {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
}

/** まだ結果が返っていないことを確かめるため、Promiseの現在の状態を読めるようにする。 */
function track(promise: Promise<boolean | undefined>) {
  let state: boolean | undefined | 'pending' = 'pending';
  void promise.then((value) => { state = value; });
  return () => state;
}

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

  it('stays open while the share sheet is open, ignoring Escape and the backdrop', async () => {
    let finish!: () => void;
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })) });
    await renderWithOffer(file);
    const settled = track(result!);

    await act(async () => { button('共有・保存').click(); });
    await act(async () => { pressEscape(); });
    await act(async () => { mouseDown(document.querySelector('.share-dialog-backdrop')!); });
    // 共有シートを開いている間に閉じると、共有を終えても「取りやめた」と返してしまう。
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button('閉じる').disabled).toBe(true);
    expect(settled()).toBe('pending');

    await act(async () => { finish(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await expect(result).resolves.toBe(true);
  });

  it('closes on Escape and on a press outside the dialog, but not on a press inside it', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn() });
    await renderWithOffer(file);
    const settled = track(result!);

    await act(async () => { mouseDown(document.querySelector('.share-dialog h2')!); });
    await act(async () => { mouseDown(document.querySelector('.share-dialog')!); });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(settled()).toBe('pending');

    await act(async () => { mouseDown(document.querySelector('.share-dialog-backdrop')!); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await expect(result).resolves.toBe(false);

    await act(async () => { result = offer!(file); });
    await act(async () => { pressEscape(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await expect(result).resolves.toBe(false);
  });

  it('treats an offer left open when the host unmounts as not shared', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: vi.fn() });
    await renderWithOffer(file);

    await act(async () => { root!.unmount(); });
    root = undefined;
    await expect(result).resolves.toBe(false);
  });

  it('does not report a file replaced while sharing as shared when the earlier share finishes', async () => {
    let finishFirst!: () => void;
    const share = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockImplementation(async () => {});
    vi.stubGlobal('navigator', { ...navigator, share });
    await renderWithOffer(file);
    const first = result!;
    await act(async () => { button('共有・保存').click(); });

    const backup = new File(['{}'], '新しい編み図.knit', { type: 'application/json' });
    let second!: Promise<boolean | undefined>;
    await act(async () => { second = offer!(backup); });
    const secondSettled = track(second);
    // 置き換えた時点で、前のファイルは共有しなかったことにする。
    await expect(first).resolves.toBe(false);

    await act(async () => { finishFirst(); });
    // 前の共有シートが閉じても、まだ共有していない次のファイルは閉じず、結果も返さない。
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('「新しい編み図.knit」の準備ができました');
    expect(button('共有・保存').disabled).toBe(false);
    expect(secondSettled()).toBe('pending');

    await act(async () => { button('共有・保存').click(); });
    expect(share).toHaveBeenLastCalledWith({ files: [backup] });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await expect(second).resolves.toBe(true);
  });

  it('starts a same-named replacement fresh while the earlier file is being shared', async () => {
    let finishFirst!: () => void;
    const share = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockImplementation(async () => {});
    vi.stubGlobal('navigator', { ...navigator, share });
    await renderWithOffer(file);
    const first = result!;
    await act(async () => { button('共有・保存').click(); });

    // 同じ編み図を作り直すと、ファイル名も同じになる。
    const regenerated = new File(['%PDF-2'], file.name, { type: 'application/pdf' });
    let second!: Promise<boolean | undefined>;
    await act(async () => { second = offer!(regenerated); });
    await expect(first).resolves.toBe(false);
    // 前のファイルの「共有中」を引き継がず、すぐに共有・保存できる。
    expect(button('共有・保存').disabled).toBe(false);
    expect(button('閉じる').disabled).toBe(false);

    await act(async () => { finishFirst(); });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => { button('閉じる').click(); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    await expect(second).resolves.toBe(false);
  });
});
