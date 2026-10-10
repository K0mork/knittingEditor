import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppDialog } from './AppDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
});

async function renderDialog() {
  // useModalFocusの次フレームのフォーカスも検証する。
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  let dialog!: ReturnType<typeof useAppDialog>;
  function Host() {
    dialog = useAppDialog();
    return dialog.dialog;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(<Host />); });
  cleanup = async () => { await act(async () => root.unmount()); container.remove(); };
  return {
    container,
    api: () => dialog,
    focusFrame: () => { frame?.(0); },
    button: (label: string) => [...container.querySelectorAll('button')].find((button) => button.textContent === label)!,
  };
}

describe('AppDialog', () => {
  it.each([
    { isComposing: true, keyCode: 13 },
    { isComposing: false, keyCode: 229 },
    { isComposing: true, keyCode: 229 },
  ])('keeps the prompt open during IME confirmation (%j)', async (event) => {
    const view = await renderDialog();
    const resolved = vi.fn();
    await act(async () => { void view.api().askText('編み図名', 'はるの').then(resolved); });
    const input = view.container.querySelector('input')!;
    expect(document.activeElement).toBe(input);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, ...event }));
    });
    expect(resolved).not.toHaveBeenCalled();
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '春のセーター');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    });
    expect(resolved).toHaveBeenCalledWith('春のセーター');
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
  });

  it.each(['「春のセーター」', 'ブロック「模様」'])('labels irreversible deletion and initially focuses cancel: %s', async (name) => {
    const view = await renderDialog();
    const resolved = vi.fn();
    await act(async () => { void view.api().askConfirm(`${name}を削除しますか？`, { destructive: true }).then(resolved); });
    expect(view.container.querySelector('h2')?.textContent).toBe(`${name}を削除しますか？`);
    const description = view.container.querySelector('#app-dialog-description')!;
    expect(description.textContent).toBe('この操作は元に戻せません。');
    expect(description.classList.contains('visually-hidden')).toBe(false);
    expect(view.button('削除').className).toBe('danger');
    expect(document.activeElement).toBe(view.button('キャンセル'));
    view.focusFrame();
    expect(document.activeElement).toBe(view.button('キャンセル'));
    await act(async () => { view.button('キャンセル').click(); });
    expect(resolved).toHaveBeenCalledWith(false);
  });

  it('resolves deletion only when the delete button is chosen', async () => {
    const view = await renderDialog();
    const resolved = vi.fn();
    await act(async () => { void view.api().askConfirm('「模様」を削除しますか？', { destructive: true }).then(resolved); });
    await act(async () => { view.button('削除').click(); });
    expect(resolved).toHaveBeenCalledWith(true);
  });

  it.each(['キャンセル', '決定'])('keeps board clearing neutral and resolves %s', async (label) => {
    const view = await renderDialog();
    const resolved = vi.fn();
    await act(async () => { void view.api().askConfirm('盤面をすべて消去しますか？').then(resolved); });
    expect(view.button('決定').className).toBe('primary');
    expect(view.container.textContent).not.toContain('元に戻せません');
    expect(document.activeElement).toBe(view.button('決定'));
    view.focusFrame();
    expect(document.activeElement).toBe(view.button('決定'));
    await act(async () => { view.button(label).click(); });
    expect(resolved).toHaveBeenCalledWith(label === '決定');
  });

  it('cancels destructive confirmation with Escape', async () => {
    const view = await renderDialog();
    const resolved = vi.fn();
    await act(async () => { void view.api().askConfirm('削除しますか？', { destructive: true }).then(resolved); });
    await act(async () => {
      view.button('キャンセル').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(resolved).toHaveBeenCalledWith(false);
  });
});
