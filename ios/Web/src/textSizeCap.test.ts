import { afterEach, describe, expect, it, vi } from 'vitest';
import { capRootFontSize, cappedRootFontSize, MAX_ROOT_FONT_SIZE } from './textSizeCap';

/** 文字サイズを読むためだけに置いた不可視の要素。 */
function probe(): Element | null {
  return document.body.querySelector('span[aria-hidden="true"]');
}

describe('cappedRootFontSize', () => {
  it('上限以下ではCSSの`-apple-system-body`に任せる', () => {
    expect(MAX_ROOT_FONT_SIZE).toBe(28);
    expect(cappedRootFontSize(17)).toBe('');
    expect(cappedRootFontSize(28)).toBe('');
  });

  it('上限を超えたらAX1の28pxで止める', () => {
    expect(cappedRootFontSize(33)).toBe('28px');
    expect(cappedRootFontSize(53)).toBe('28px');
  });

  it('読めない値ではCSSの`-apple-system-body`に任せる', () => {
    expect(cappedRootFontSize(Number.NaN)).toBe('');
    expect(cappedRootFontSize(0)).toBe('');
  });
});

describe('capRootFontSize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.documentElement.style.fontSize = '';
    document.body.innerHTML = '';
  });

  it('システムの文字サイズが上限を超えるときだけルートへ28pxを設定する', () => {
    const computed = vi.spyOn(window, 'getComputedStyle')
      .mockReturnValue({ fontSize: '33px' } as CSSStyleDeclaration);
    const cleanup = capRootFontSize(document);
    expect(probe()).not.toBeNull();
    expect(document.documentElement.style.fontSize).toBe('28px');

    // システムの文字サイズがAX1以下へ戻ったら、インライン指定を外してCSSへ任せる。
    computed.mockReturnValue({ fontSize: '28px' } as CSSStyleDeclaration);
    window.dispatchEvent(new Event('resize'));
    expect(document.documentElement.style.fontSize).toBe('');

    cleanup();
    expect(probe()).toBeNull();
  });

  it('システムの文字サイズが変わったらResizeObserverで設定し直す', () => {
    const computed = vi.spyOn(window, 'getComputedStyle')
      .mockReturnValue({ fontSize: '17px' } as CSSStyleDeclaration);
    let onChange: ResizeObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    class FakeResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        onChange = callback;
      }
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const cleanup = capRootFontSize(document);
    expect(observe).toHaveBeenCalledTimes(1);
    expect(document.documentElement.style.fontSize).toBe('');

    computed.mockReturnValue({ fontSize: '40px' } as CSSStyleDeclaration);
    onChange?.([], {} as ResizeObserver);
    expect(document.documentElement.style.fontSize).toBe('28px');

    cleanup();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(probe()).toBeNull();
  });
});
