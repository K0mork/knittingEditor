import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listenNativeFold } from './nativeBridge';
import { observeFoldOverlays } from './nativeFoldLayout';

let frame: FrameRequestCallback;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

const root = document.documentElement;
const send = (detail: unknown) => window.dispatchEvent(new CustomEvent('knittingEditorNativeFoldChanged', { detail }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; root.removeAttribute('data-fold'); root.removeAttribute('style'); });

describe('native fold bridge', () => {
  it('observes only during a valid fold and resets even detached overlays on null', () => {
    const mutationObserve = vi.fn();
    const mutationDisconnect = vi.fn();
    const resizeObserve = vi.fn();
    const resizeDisconnect = vi.fn();
    const mutationConstructor = vi.fn(function () {
      return { observe: mutationObserve, disconnect: mutationDisconnect };
    });
    const resizeConstructor = vi.fn(function () {
      return { observe: resizeObserve, unobserve: vi.fn(), disconnect: resizeDisconnect };
    });
    vi.stubGlobal('MutationObserver', mutationConstructor);
    vi.stubGlobal('ResizeObserver', resizeConstructor);
    const request = vi.spyOn(window, 'requestAnimationFrame');
    const add = vi.spyOn(window, 'addEventListener');
    const removeEvent = vi.spyOn(window, 'removeEventListener');
    const element = document.createElement('div');
    element.className = 'toast';
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
      x: 450, y: 450, left: 450, top: 450, right: 550, bottom: 490,
      width: 100, height: 40, toJSON() {},
    });
    document.body.append(element);
    const remove = listenNativeFold();
    try {
      send(null);
      send({ axis: 'diagonal', start: 455.5, end: 495.5 });
      expect(mutationConstructor).not.toHaveBeenCalled();
      expect(resizeConstructor).not.toHaveBeenCalled();
      expect(add.mock.calls.filter(([type]) => String(type) === 'resize')).toHaveLength(0);
      expect(request).not.toHaveBeenCalled();

      send({ axis: 'vertical', start: 455.5, end: 495.5 });
      expect(mutationConstructor).toHaveBeenCalledTimes(1);
      expect(resizeConstructor).toHaveBeenCalledTimes(1);
      expect(mutationObserve).toHaveBeenCalledWith(root, { childList: true, subtree: true });
      expect(add.mock.calls.filter(([type]) => String(type) === 'resize')).toHaveLength(1);
      expect(request).toHaveBeenCalledTimes(1);
      frame(0);
      expect(resizeObserve.mock.calls.map(([target]) => target)).toEqual([element]);
      expect(element.hasAttribute('data-fold-adjusted')).toBe(true);

      for (const detail of [
        { axis: 'horizontal', start: 455.5, end: 495.5 },
        { axis: 'horizontal', start: 440, end: 495.5 },
        { axis: 'horizontal', start: 440, end: 500 },
      ]) {
        const count = request.mock.calls.length;
        send(detail);
        expect(request).toHaveBeenCalledTimes(count + 1);
        frame(0);
        send(detail);
        expect(request).toHaveBeenCalledTimes(count + 1);
      }
      expect(element.style.getPropertyValue('--fold-shift-y')).toBe('-58px');
      expect(mutationConstructor).toHaveBeenCalledTimes(1);
      expect(resizeConstructor).toHaveBeenCalledTimes(1);

      // null must cancel pending work and clear previously adjusted detached elements too.
      window.dispatchEvent(new Event('resize'));
      element.remove();
      send(null);
      expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
      expect(mutationDisconnect).toHaveBeenCalledTimes(1);
      expect(resizeDisconnect).toHaveBeenCalledTimes(1);
      const resizeListener = add.mock.calls.find(([type]) => String(type) === 'resize')![1];
      expect(removeEvent).toHaveBeenCalledWith('resize', resizeListener);
      expect(element.hasAttribute('data-fold-adjusted')).toBe(false);
      for (const property of ['--fold-shift-x', '--fold-shift-y', '--fold-max-width', '--fold-max-height']) {
        expect(element.style.getPropertyValue(property)).toBe('');
      }
      const count = request.mock.calls.length;
      window.dispatchEvent(new Event('resize'));
      send(null);
      expect(request).toHaveBeenCalledTimes(count);
      expect(mutationDisconnect).toHaveBeenCalledTimes(1);

      send({ axis: 'vertical', start: 455.5, end: 495.5 });
      expect(mutationConstructor).toHaveBeenCalledTimes(2);
      expect(resizeConstructor).toHaveBeenCalledTimes(2);
    } finally { remove(); }
    expect(mutationDisconnect).toHaveBeenCalledTimes(2);
    expect(resizeDisconnect).toHaveBeenCalledTimes(2);
  });
  it('sets both axes in CSS pixels and clears every property after unfolding', () => {
    const remove = listenNativeFold();
    try {
      for (const axis of ['vertical', 'horizontal']) {
        send({ axis, start: 455.5, end: 495.5 });
        expect(root.dataset.fold).toBe(axis);
        expect(root.style.getPropertyValue('--fold-start')).toBe('455.5px');
        expect(root.style.getPropertyValue('--fold-end')).toBe('495.5px');
      }
      send(null);
      expect(root.hasAttribute('data-fold')).toBe(false);
      expect(root.style.getPropertyValue('--fold-start')).toBe('');
      expect(root.style.getPropertyValue('--fold-end')).toBe('');
    } finally { remove(); }
  });
  it('ignores malformed input and removes its event subscription', () => {
    const remove = listenNativeFold();
    send({ axis: 'vertical', start: 10, end: 30 });
    window.dispatchEvent(new Event('knittingEditorNativeFoldChanged'));
    for (const detail of [{}, 'vertical', { axis: 'diagonal', start: 1, end: 3 },
      ...[NaN, Infinity, '10', undefined].map(start => ({ axis: 'vertical', start, end: 30 })),
      { axis: 'horizontal', start: 30, end: 20 }]) send(detail);
    expect(root.dataset.fold).toBe('vertical');
    expect(root.style.getPropertyValue('--fold-start')).toBe('10px');
    remove();
    send(null);
    expect(root.dataset.fold).toBe('vertical');
  });
});


describe('fold overlay measurement', () => {
  it.each(['vertical', 'horizontal'] as const)('adjusts only intersections on the %s axis and restores on cleanup', (axis) => {
    root.dataset.fold = axis;
    root.style.setProperty('--fold-start', '455.5px');
    root.style.setProperty('--fold-end', '495.5px');
    const elements = [100, 450, 600].map(position => {
      const element = document.createElement('div');
      element.className = 'toast';
      const x = axis === 'vertical' ? position : 100;
      const y = axis === 'horizontal' ? position : 100;
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ x, y, left: x, top: y, right: x + 100, bottom: y + 40, width: 100, height: 40, toJSON() {} });
      document.body.append(element);
      return element;
    });
    const stop = observeFoldOverlays();
    frame(0);
    expect(elements.map(element => element.hasAttribute('data-fold-adjusted'))).toEqual([false, true, false]);
    expect(elements[1].style.getPropertyValue(axis === 'vertical' ? '--fold-shift-x' : '--fold-shift-y')).toBe(axis === 'vertical' ? '57.5px' : '-42.5px');
    stop.stop();
    for (const element of elements) {
      expect(element.hasAttribute('data-fold-adjusted')).toBe(false);
      expect(element.style.getPropertyValue('--fold-shift-x')).toBe('');
    }
  });
});
