import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { NOTIFICATION_DURATION_MS, useModalFocus, useNotifier, usePanelFocus } from './hooks';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it('handles only the topmost modal and respects composition, inputs, and other handlers', async () => {
  const container = document.createElement('div');
  const opener = document.createElement('button');
  document.body.append(opener, container);
  opener.focus();
  const lowerClose = vi.fn();
  const upperClose = vi.fn();
  function Modal({ close }: { close: () => void }) {
    const ref = useModalFocus<HTMLElement>(close);
    return <section ref={ref} role="dialog"><button>閉じる</button><input type="text" /><input type="color" /></section>;
  }
  const root = createRoot(container);
  const dispatch = (target: EventTarget, options: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...options });
    target.dispatchEvent(event);
    return event;
  };
  try {
    await act(async () => root.render(<><Modal close={lowerClose} /><Modal close={upperClose} /></>));
    expect(dispatch(document.body, { isComposing: true }).defaultPrevented).toBe(false);
    expect(dispatch(document.body, { keyCode: 229 }).defaultPrevented).toBe(false);
    const prevented = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    prevented.preventDefault();
    document.body.dispatchEvent(prevented);
    const outsideInput = document.createElement('input');
    const otherDialog = document.createElement('section');
    otherDialog.setAttribute('role', 'dialog');
    document.body.append(outsideInput, otherDialog);
    dispatch(outsideInput);
    dispatch(otherDialog);
    outsideInput.remove();
    otherDialog.remove();
    dispatch(container.querySelectorAll('input[type="color"]')[1]);
    expect(upperClose).not.toHaveBeenCalled();
    expect(dispatch(document.body).defaultPrevented).toBe(true);
    expect(upperClose).toHaveBeenCalledTimes(1);
    expect(lowerClose).not.toHaveBeenCalled();
    // 入力ダイアログ内の通常のEscapeキャンセルは維持する。
    dispatch(container.querySelectorAll('input[type="text"]')[1]);
    expect(upperClose).toHaveBeenCalledTimes(2);
    await act(async () => root.render(<Modal close={lowerClose} />));
    dispatch(document.body);
    expect(lowerClose).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    expect(document.activeElement).toBe(opener);
    dispatch(document.body);
    expect(lowerClose).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    opener.remove();
  }
});

it('keeps focus in the front modal when only the background modal closes', async () => {
  const container = document.createElement('div');
  const opener = document.createElement('button');
  document.body.append(opener, container);
  opener.focus();
  function Modal({ label }: { label: string }) {
    const ref = useModalFocus<HTMLElement>(() => undefined);
    return <section ref={ref} role="dialog"><button>{label}</button></section>;
  }
  function Modals({ showBack }: { showBack: boolean }) {
    return <>{showBack && <Modal label="背面" />}<Modal label="前面" /></>;
  }
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Modals showBack />));
    const front = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '前面');
    front?.focus();
    await act(async () => root.render(<Modals showBack={false} />));
    expect(document.activeElement).toBe(front);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    opener.remove();
  }
});

it('clears a toast and its action together after the notification duration', async () => {
  vi.useFakeTimers();
  const container = document.createElement('div');
  document.body.append(container);
  let latest!: ReturnType<typeof useNotifier>;
  function Probe() {
    latest = useNotifier();
    return null;
  }
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Probe />));
    const action = { label: 'やり方を見る', run: vi.fn() };
    await act(async () => latest.notify('案内', action));
    expect(latest.message).toBe('案内');
    expect(latest.notificationAction).toBe(action);
    await act(async () => { vi.advanceTimersByTime(NOTIFICATION_DURATION_MS - 1); });
    expect(latest.notificationAction).toBe(action);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(latest.message).toBe('');
    expect(latest.notificationAction).toBeUndefined();
    expect(action.run).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  }
});

it('cycles Tab and Shift+Tab between visible enabled modal controls only', async () => {
  vi.useFakeTimers();
  // jsdomにはレイアウトがないため、表示中の要素にだけ矩形を与える。
  const rects = vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.dataset.offscreen ? [] : [{}]) as unknown as DOMRectList;
  });
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  function Modal() {
    const ref = useModalFocus<HTMLElement>(() => undefined);
    return <section ref={ref}><button hidden>非表示</button><button disabled>無効</button>
      <button data-offscreen="true">矩形なし</button><button>最初</button><input /><button>最後</button></section>;
  }
  const tab = (target: HTMLElement, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  try {
    await act(async () => root.render(<Modal />));
    await act(async () => { vi.advanceTimersByTime(20); });
    const first = container.querySelectorAll('button')[3];
    const last = container.querySelectorAll('button')[4];
    expect(document.activeElement).toBe(first);
    expect(tab(first, true)).toBe(true);
    expect(document.activeElement).toBe(last);
    expect(tab(last)).toBe(true);
    expect(document.activeElement).toBe(first);
    expect(tab(first)).toBe(false);
    expect(tab(document.body)).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    rects.mockRestore();
    vi.useRealTimers();
  }
});

it('moves drawer focus to its heading, preserves user input focus, and returns to its trigger', async () => {
  vi.useFakeTimers();
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  function Drawer({ open }: { open: boolean }) {
    const { panelRef, rememberTrigger } = usePanelFocus<HTMLElement>(open);
    return <><button onClick={rememberTrigger}>開く</button>{open && <section ref={panelRef}>
      <h2 tabIndex={-1}>設定</h2><input /></section>}</>;
  }
  const render = async (open: boolean) => { await act(async () => root.render(<Drawer open={open} />)); };
  const frame = async () => { await act(async () => { vi.advanceTimersByTime(20); }); };
  try {
    await render(false);
    const trigger = container.querySelector('button')!;
    trigger.focus();
    await act(async () => trigger.click());
    await render(true);
    await frame();
    expect(document.activeElement).toBe(container.querySelector('h2'));
    await render(false);
    await frame();
    expect(document.activeElement).toBe(trigger);
    await render(true);
    const input = container.querySelector('input')!;
    input.focus();
    await frame();
    expect(document.activeElement).toBe(input);
    await render(false);
    await frame();
    expect(document.activeElement).toBe(trigger);
    // 開くフレームを待つ前に閉じても、見出しへ移動する処理が残らない。
    await render(true);
    await render(false);
    await frame();
    expect(document.activeElement).toBe(trigger);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  }
});
