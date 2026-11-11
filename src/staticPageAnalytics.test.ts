import { describe, expect, it } from 'vitest';
import { ANALYTICS_OPT_OUT_KEY, MEASUREMENT_ID, PRODUCTION_HOST, shouldMeasure, start } from '../public/analytics.js';
import {
  ANALYTICS_OPT_OUT_KEY as EDITOR_OPT_OUT_KEY,
  MEASUREMENT_ID as EDITOR_MEASUREMENT_ID,
} from './analytics';

const CHROME = 'Mozilla/5.0 Chrome/152.0.0.0';

describe('静的ページの計測', () => {
  it('編集画面と同じGA4の測定IDと、同じ送信の停止キーを使う', () => {
    expect(MEASUREMENT_ID).toBe(EDITOR_MEASUREMENT_ID);
    expect(ANALYTICS_OPT_OUT_KEY).toBe(EDITOR_OPT_OUT_KEY);
    expect(PRODUCTION_HOST).toBe('knittingeditor.com');
  });

  it.each([
    [{ production: true, webdriver: false, userAgent: CHROME, optedOut: false }, true],
    [{ production: false, webdriver: false, userAgent: CHROME, optedOut: false }, false],
    [{ production: true, webdriver: true, userAgent: CHROME, optedOut: false }, false],
    [{ production: true, webdriver: false, userAgent: 'Mozilla/5.0 Claude/2.37337.1 Chrome/152.0.0.0', optedOut: false }, false],
    [{ production: true, webdriver: false, userAgent: 'Mozilla/5.0 claude/2.0 Chrome/152.0.0.0', optedOut: false }, true],
    [{ production: true, webdriver: false, userAgent: CHROME, optedOut: true }, false],
  ])('計測してよい環境かを決める: %o', (environment, expected) => {
    expect(shouldMeasure(environment)).toBe(expected);
  });

  it('本番ではページの閲覧を設定し、計測用の印を付けたリンクのクリックを送る', () => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<a href="https://apps.apple.com/jp/app/id6829961403" data-analytics="app_store">App Store</a>';
    delete (window as { dataLayer?: unknown }).dataLayer;

    const started = start({
      location: { hostname: 'knittingeditor.com' },
      navigator: { webdriver: false, userAgent: CHROME },
      storage: { getItem: () => null },
      document,
    });
    expect(started).toBe(true);

    document.querySelector('a')!.addEventListener('click', (event) => event.preventDefault());
    document.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const dataLayer = window.dataLayer ?? [];
    // gtag.jsは`arguments`オブジェクトだけを命令として扱う。配列を積むと何も送られない。
    expect(dataLayer.map((command) => Object.prototype.toString.call(command))).toEqual(
      dataLayer.map(() => '[object Arguments]'),
    );
    const commands = dataLayer.map((command) => Array.from(command as ArrayLike<unknown>));
    expect(commands).toContainEqual(['config', MEASUREMENT_ID]);
    expect(commands).toContainEqual(['event', 'link_clicked', { link_name: 'app_store' }]);
  });
});
