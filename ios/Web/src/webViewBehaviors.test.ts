import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';

/**
 * iOS版の編集画面は、ピンチやダブルタップで画面全体を拡大しない（#81）。文字の拡大は
 * Dynamic Typeで行う。実際の挙動と、長押しの文字選択を抑えるCSSは、XCUITestの
 * `testEditorChromeIgnoresPageZoomAndTextSelection`で確かめる。ここではSimulatorを
 * 使わずに、viewportの設定を戻してしまった変更を見つける。
 */
describe('iOS editor viewport', () => {
  it('does not let pinch or double tap zoom the whole page', () => {
    const viewport = new DOMParser()
      .parseFromString(indexHtml, 'text/html')
      .querySelector('meta[name="viewport"]')
      ?.getAttribute('content');
    const values = new Map((viewport ?? '').split(',').map((entry) => {
      const [key, value] = entry.split('=').map((part) => part.trim());
      return [key, value] as const;
    }));
    expect(values.get('width')).toBe('device-width');
    expect(values.get('initial-scale')).toBe('1');
    expect(values.get('maximum-scale')).toBe('1');
    expect(values.get('user-scalable')).toBe('no');
  });
});
