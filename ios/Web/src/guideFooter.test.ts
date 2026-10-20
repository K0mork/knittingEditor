import { describe, expect, it } from 'vitest';
import guideHtml from '../public/guide/index.html?raw';

describe('guide return links', () => {
  it('offers support and the canonical app policy as explicit external links', () => {
    const guide = new DOMParser().parseFromString(guideHtml, 'text/html');
    const externalLinks = [...guide.querySelectorAll('a[href^="https:"]')];
    expect(externalLinks.map((link) => link.getAttribute('href')).sort()).toEqual([
      'https://knittingeditor.com/privacy/app/',
      'https://knittingeditor.com/support/',
    ]);
    for (const link of externalLinks) expect(link.getAttribute('rel')).toBe('noreferrer');
    const privacyHeading = [...guide.querySelectorAll('h2')].find((heading) => heading.textContent === 'プライバシー');
    let section = '';
    for (let node = privacyHeading?.nextElementSibling; node && node.tagName !== 'H2'; node = node.nextElementSibling) section += node.outerHTML;
    expect(section).toContain('href="https://knittingeditor.com/privacy/app/"');
    expect(section).toContain('タップした場合だけSafariで開きます');
    expect(guide.querySelectorAll('iframe, link[rel="prefetch"], link[rel="preload"]').length).toBe(0);
  });
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
