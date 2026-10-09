import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterNextPaint, useNotifyWhenEditorShown } from './editorReady';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** `requestAnimationFrame`を手で進める。 */
function fakeFrames() {
  let next = 1;
  const queue = new Map<number, FrameRequestCallback>();
  return {
    frame: (callback: FrameRequestCallback) => { queue.set(next, callback); return next++; },
    cancel: (handle: number) => { queue.delete(handle); },
    /** 今予約されている分だけを1フレームとして呼ぶ。 */
    tick() {
      const current = [...queue.entries()];
      queue.clear();
      for (const [, callback] of current) callback(0);
    },
    get pending() { return queue.size; },
  };
}

describe('afterNextPaint', () => {
  it('waits for the frame after the next one', () => {
    const frames = fakeFrames();
    const callback = vi.fn();
    afterNextPaint(callback, frames.frame, frames.cancel);
    frames.tick();
    expect(callback).not.toHaveBeenCalled();
    frames.tick();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled before or between the two frames', () => {
    const frames = fakeFrames();
    const callback = vi.fn();
    afterNextPaint(callback, frames.frame, frames.cancel)();
    frames.tick();
    const cancelLater = afterNextPaint(callback, frames.frame, frames.cancel);
    frames.tick();
    cancelLater();
    frames.tick();
    expect(callback).not.toHaveBeenCalled();
    expect(frames.pending).toBe(0);
  });
});

describe('useNotifyWhenEditorShown', () => {
  let frames: ReturnType<typeof fakeFrames>;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    frames = fakeFrames();
    vi.stubGlobal('requestAnimationFrame', frames.frame);
    vi.stubGlobal('cancelAnimationFrame', frames.cancel);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  function Probe({ shown, notify }: { shown: boolean; notify: () => void }) {
    useNotifyWhenEditorShown(shown, notify);
    return null;
  }

  it('does not notify while the editor is still loading', async () => {
    const notify = vi.fn();
    await act(async () => root.render(createElement(Probe, { shown: false, notify })));
    frames.tick();
    frames.tick();
    expect(notify).not.toHaveBeenCalled();
  });

  it('notifies once, after the editor has been painted', async () => {
    const notify = vi.fn();
    await act(async () => root.render(createElement(Probe, { shown: false, notify })));
    await act(async () => root.render(createElement(Probe, { shown: true, notify })));
    expect(notify).not.toHaveBeenCalled();
    frames.tick();
    frames.tick();
    expect(notify).toHaveBeenCalledTimes(1);
    // 再描画や表示の切り替えでは送り直さない。
    await act(async () => root.render(createElement(Probe, { shown: false, notify })));
    await act(async () => root.render(createElement(Probe, { shown: true, notify })));
    frames.tick();
    frames.tick();
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
