import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_OPT_OUT_KEY,
  MEASUREMENT_ID,
  PRODUCTION_HOST,
  SAME_TAB_NAVIGATE_TIMEOUT_MS,
  shouldMeasure,
  start,
} from '../public/analytics.js';
import {
  ANALYTICS_OPT_OUT_KEY as EDITOR_OPT_OUT_KEY,
  MEASUREMENT_ID as EDITOR_MEASUREMENT_ID,
} from './analytics';

const CHROME = 'Mozilla/5.0 Chrome/152.0.0.0';

/** `start()`がdocumentへ足したクリックの捕捉を、テストごとに外すために覚えておく。 */
const clickHandlers: EventListener[] = [];

function measuredPage(html: string, storage: Pick<Storage, 'getItem'> = { getItem: () => null }): {
  started: boolean;
  assigned: string[];
  commands: () => unknown[][];
} {
  document.head.innerHTML = '';
  document.body.innerHTML = html;
  delete (window as { dataLayer?: unknown }).dataLayer;

  const assigned: string[] = [];
  const addSpy = vi.spyOn(document, 'addEventListener');
  const started = start({
    location: { hostname: 'knittingeditor.com', assign: (url: string) => { assigned.push(url); } },
    navigator: { webdriver: false, userAgent: CHROME },
    storage,
    document,
  });
  const clickCall = addSpy.mock.calls.find(([type]) => type === 'click');
  if (clickCall) clickHandlers.push(clickCall[1] as EventListener);
  addSpy.mockRestore();
  return {
    started,
    assigned,
    commands: () => (window.dataLayer ?? []).map((command) => Array.from(command as ArrayLike<unknown>)),
  };
}

/** 最後に積んだ`link_clicked`の命令。修飾キーなどで何度押しても、直前の押下を見られる。 */
function lastLinkClicked(page: ReturnType<typeof measuredPage>) {
  return page.commands().filter((command) => command[0] === 'event' && command[1] === 'link_clicked').at(-1);
}

function click(selector: string, overrides: MouseEventInit = {}) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...overrides });
  document.querySelector(selector)!.dispatchEvent(event);
  return event;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const handler of clickHandlers.splice(0)) document.removeEventListener('click', handler, true);
});

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

  it('本番ではページの閲覧を設定し、同じタブで移るリンクはbeaconで送ってから移動する', () => {
    vi.useFakeTimers();
    const page = measuredPage('<a href="/" data-analytics="editor">編み図を作成する</a>');
    expect(page.started).toBe(true);
    const href = document.querySelector('a')!.href;

    const event = click('a');
    expect(event.defaultPrevented).toBe(true);
    // gtag.jsは`arguments`オブジェクトだけを命令として扱う。配列を積むと何も送られない。
    expect((window.dataLayer ?? []).map((command) => Object.prototype.toString.call(command))).toEqual(
      (window.dataLayer ?? []).map(() => '[object Arguments]'),
    );
    expect(page.commands()).toContainEqual(['config', MEASUREMENT_ID]);
    expect(lastLinkClicked(page)).toEqual(['event', 'link_clicked', {
      link_name: 'editor',
      transport_type: 'beacon',
      event_callback: expect.any(Function),
      event_timeout: SAME_TAB_NAVIGATE_TIMEOUT_MS,
    }]);
    // gtag.jsが送った後に呼ぶコールバックが来るまでは移動しない。
    expect(page.assigned).toEqual([]);

    const { event_callback } = lastLinkClicked(page)![2] as { event_callback: () => void };
    event_callback();
    expect(page.assigned).toEqual([href]);
    // コールバックと猶予の時間の両方が来ても、移動は1回だけ。
    event_callback();
    vi.advanceTimersByTime(SAME_TAB_NAVIGATE_TIMEOUT_MS * 2);
    expect(page.assigned).toEqual([href]);
  });

  it('コールバックが来なくても（gtag.jsが止められても）猶予の時間で移動する', () => {
    vi.useFakeTimers();
    const page = measuredPage('<a href="https://apps.apple.com/jp/app/id6829961403" data-analytics="app_store">App Store</a>');
    const href = document.querySelector('a')!.href;

    const event = click('a');
    expect(event.defaultPrevented).toBe(true);
    expect(lastLinkClicked(page)).toBeDefined();
    expect(page.assigned).toEqual([]);
    vi.advanceTimersByTime(SAME_TAB_NAVIGATE_TIMEOUT_MS - 1);
    expect(page.assigned).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(page.assigned).toEqual([href]);
  });

  it('target="_self"のリンクも同じタブとして扱う', () => {
    vi.useFakeTimers();
    const page = measuredPage('<a href="/" target="_self" data-analytics="editor">編み図を作成する</a>');
    const href = document.querySelector('a')!.href;

    const event = click('a');
    expect(event.defaultPrevented).toBe(true);
    expect(lastLinkClicked(page)![2]).toMatchObject({ transport_type: 'beacon' });
    vi.advanceTimersByTime(SAME_TAB_NAVIGATE_TIMEOUT_MS);
    expect(page.assigned).toEqual([href]);
  });

  it('修飾キー・主以外のボタン・新しいタブ・ダウンロードは既定の動作のまま送るだけにする', () => {
    const page = measuredPage(
      '<a id="same" href="/" data-analytics="editor">編み図を作成する</a>'
      + '<a id="blank" href="/" target="_blank" data-analytics="editor">新しいタブで開く</a>'
      + '<a id="download" href="/templates/seed.knit" download data-analytics="template_seed">テンプレート</a>',
    );
    const cases: Array<[string, MouseEventInit, Record<string, unknown>]> = [
      ['#same', { ctrlKey: true }, { link_name: 'editor' }],
      ['#same', { metaKey: true }, { link_name: 'editor' }],
      ['#same', { shiftKey: true }, { link_name: 'editor' }],
      ['#same', { altKey: true }, { link_name: 'editor' }],
      ['#same', { button: 2 }, { link_name: 'editor' }],
      ['#blank', {}, { link_name: 'editor' }],
      ['#download', {}, { link_name: 'template_seed' }],
    ];
    for (const [selector, overrides, parameters] of cases) {
      const event = click(selector, overrides);
      expect(event.defaultPrevented, selector).toBe(false);
      expect(page.assigned, selector).toEqual([]);
      // beaconもコールバックも付けず、そのまま送る。
      expect(lastLinkClicked(page)![2], selector).toEqual(parameters);
    }
  });

  it('既定の動作を止められたクリックは移動させない', () => {
    const page = measuredPage('<a href="/" data-analytics="editor">編み図を作成する</a>');
    // 捕捉段階のより外側（window）で止める。`analytics.js`はdocumentの捕捉段階で、止められた後を見る。
    const preventer = (event: Event) => event.preventDefault();
    window.addEventListener('click', preventer, { capture: true });
    click('a');
    window.removeEventListener('click', preventer, { capture: true });

    expect(lastLinkClicked(page)![2]).toEqual({ link_name: 'editor' });
    expect(page.assigned).toEqual([]);
  });

  it('計測しない環境（オプトアウト）では押しても送らず、既定の動作も止めない', () => {
    const page = measuredPage('<a href="/" data-analytics="editor">編み図を作成する</a>', { getItem: () => '1' });
    expect(page.started).toBe(false);

    const event = click('a');
    expect(event.defaultPrevented).toBe(false);
    expect(window.dataLayer).toBeUndefined();
    expect(document.scripts).toHaveLength(0);
  });
});
