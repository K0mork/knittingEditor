import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectInputEnvironment, gestureHintText, getInputEnvironment, historyTitles, pastePromptText,
  resetInputEnvironment, useInputEnvironment, type InputEnvironment,
} from './inputEnvironment';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const touch: InputEnvironment = { pointer: 'touch', keyboard: false, apple: true };
const windowsMouse: InputEnvironment = { pointer: 'mouse', keyboard: true, apple: false };
const macMouse: InputEnvironment = { pointer: 'mouse', keyboard: true, apple: true };

function mockMedia(matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: matching.includes(query) }) as MediaQueryList);
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetInputEnvironment();
});

describe('detectInputEnvironment', () => {
  it('treats a coarse primary pointer as touch without a keyboard', () => {
    mockMedia(['(pointer: coarse)']);
    expect(detectInputEnvironment()).toMatchObject({ pointer: 'touch', keyboard: false });
  });

  it('treats a fine hovering pointer as a mouse with a keyboard', () => {
    mockMedia(['(pointer: fine)', '(hover: hover)']);
    expect(detectInputEnvironment()).toMatchObject({ pointer: 'mouse', keyboard: true });
  });

  it('writes shortcuts with ⌘ on Mac, iPhone, and iPad', () => {
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    expect(detectInputEnvironment().apple).toBe(true);
    vi.stubGlobal('navigator', { platform: '', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' });
    expect(detectInputEnvironment().apple).toBe(true);
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    expect(detectInputEnvironment().apple).toBe(false);
  });
});

describe('guidance text', () => {
  it('describes finger gestures for touch and wheel gestures for a mouse or trackpad', () => {
    expect(gestureHintText('draw', touch)).toBe('1本指：描画　2本指：移動・拡大');
    expect(gestureHintText('erase', windowsMouse)).toBe('ドラッグ：消去　ホイール：移動　Ctrl＋ホイール：拡大');
    expect(gestureHintText('select', macMouse)).toBe('ドラッグ：範囲選択　ホイール：移動　⌘＋ホイール：拡大');
    expect(gestureHintText('paste', macMouse)).toBe('クリック：貼り付け　ホイール：移動　⌘＋ホイール：拡大');
  });

  it('asks to tap or click the paste position', () => {
    expect(pastePromptText(touch)).toBe('貼り付ける左上のセルをタップしてください');
    expect(pastePromptText(windowsMouse)).toBe('貼り付ける左上のセルをクリックしてください');
  });

  it('shows only the shortcuts of the current platform', () => {
    expect(historyTitles(macMouse)).toEqual({ undo: '元に戻す（⌘Z）', redo: 'やり直す（⇧⌘Z）' });
    expect(historyTitles(windowsMouse)).toEqual({ undo: '元に戻す（Ctrl+Z）', redo: 'やり直す（Ctrl+Y）' });
  });
});

describe('useInputEnvironment', () => {
  it('follows the input that was used last', async () => {
    mockMedia(['(pointer: coarse)']);
    const seen: InputEnvironment[] = [];
    function Probe() {
      seen.push(useInputEnvironment());
      return null;
    }
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(<Probe />));
    const latest = () => seen[seen.length - 1];
    expect(latest()).toMatchObject({ pointer: 'touch', keyboard: false });

    // iPadにトラックパッドをつないで操作したとき。
    await act(async () => { window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse' })); });
    expect(latest().pointer).toBe('mouse');
    await act(async () => { window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' })); });
    expect(latest().pointer).toBe('touch');
    await act(async () => { window.dispatchEvent(new WheelEvent('wheel', { deltaY: 10 })); });
    expect(latest().pointer).toBe('mouse');

    // ソフトウェアキーボードの文字入力では切り替えない。
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); });
    expect(latest().keyboard).toBe(false);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(latest().keyboard).toBe(true);
    expect(getInputEnvironment()).toBe(latest());

    await act(async () => root.unmount());
  });
});
