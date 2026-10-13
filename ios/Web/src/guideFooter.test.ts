import { describe, expect, it } from 'vitest';
import guideHtml from '../public/guide/index.html?raw';

describe('guide return links', () => {
  it('uses the same editor wording and destination for the bottom button and footer', () => {
    const guide = new DOMParser().parseFromString(guideHtml, 'text/html');
    const button = guide.querySelector('main a.cta');
    const footer = guide.querySelector('footer a');
    expect(button?.textContent).toBe('編集画面へ戻る');
    expect(footer?.textContent).toBe(button?.textContent);
    expect(footer?.getAttribute('href')).toBe('/index.html');
    expect(footer?.getAttribute('href')).toBe(button?.getAttribute('href'));
  });
});
