import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useModalFocus } from './hooks';

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
