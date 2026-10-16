import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadAnalytics() {
  return import('./analytics');
}

function queuedCommand(index: number): unknown[] {
  return Array.from(window.dataLayer?.[index] ?? []);
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.head.innerHTML = '';
  delete window.dataLayer;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('analytics', () => {
  it.each([
    [{}, true],
    [{ prod: false }, false],
    [{ webdriver: true }, false],
    [{ userAgent: 'Mozilla/5.0 Claude/2.37337.1 Chrome/152.0.0.0' }, false],
    [{ userAgent: 'Mozilla/5.0 claude/2.0 Chrome/152.0.0.0' }, true],
    [{ userAgent: 'Mozilla/5.0 Claude Chrome/152.0.0.0' }, true],
    [{ optedOut: true }, false],
  ])('decides whether to send analytics for %o', async (overrides, expected) => {
    const { shouldSendAnalytics } = await loadAnalytics();
    expect(shouldSendAnalytics({
      prod: true, webdriver: false, userAgent: 'Mozilla/5.0 Chrome/152.0.0.0', optedOut: false,
      ...overrides,
    })).toBe(expected);
  });

  it.each(['claude', 'opt-out', 'webdriver', 'development'])('disables default initialization for %s', async (reason) => {
    vi.stubEnv('PROD', reason !== 'development');
    vi.stubGlobal('navigator', {
      webdriver: reason === 'webdriver',
      userAgent: reason === 'claude' ? 'Mozilla/5.0 Claude/2.37337.1 Chrome/152.0.0.0' : 'Mozilla/5.0 Chrome/152.0.0.0',
    });
    if (reason === 'opt-out') localStorage.setItem('knitting-editor:analytics-opt-out', '1');
    const { initializeAnalytics, trackAnalyticsEvent, trackFirstEdit } = await loadAnalytics();
    initializeAnalytics();
    trackAnalyticsEvent('editor_ready');
    trackFirstEdit();

    expect(window.dataLayer).toBeUndefined();
    expect(document.scripts).toHaveLength(0);
  });

  it.each([null, '0', 'true', 'unavailable', 'getter-unavailable'])('initializes by default without exact opt-out: %s', async (value) => {
    vi.stubEnv('PROD', true);
    vi.stubGlobal('navigator', { webdriver: false, userAgent: 'Mozilla/5.0 Chrome/152.0.0.0' });
    if (value === 'getter-unavailable') {
      vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('unavailable'); });
    } else if (value === 'unavailable') {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('unavailable'); });
    } else if (value !== null) {
      localStorage.setItem('knitting-editor:analytics-opt-out', value);
    }
    const { initializeAnalytics } = await loadAnalytics();
    initializeAnalytics();

    expect(document.scripts).toHaveLength(1);
    expect(window.dataLayer).toHaveLength(2);
  });

  it('does not initialize when analytics is disabled', async () => {
    const { initializeAnalytics, trackAnalyticsEvent } = await loadAnalytics();
    initializeAnalytics(false);
    trackAnalyticsEvent('editor_ready');

    expect(window.dataLayer).toBeUndefined();
    expect(document.scripts).toHaveLength(0);
  });

  it('initializes the Google tag only once', async () => {
    const { initializeAnalytics } = await loadAnalytics();
    initializeAnalytics(true);
    initializeAnalytics(true);

    expect(document.scripts).toHaveLength(1);
    expect(document.scripts[0].src).toBe('https://www.googletagmanager.com/gtag/js?id=G-VVE0G4ZFL4');
    expect(window.dataLayer).toHaveLength(2);
    expect(Array.isArray(window.dataLayer?.[0])).toBe(false);
    expect(queuedCommand(0)[0]).toBe('js');
    expect(queuedCommand(0)[1]).toBeInstanceOf(Date);
    expect(queuedCommand(1)).toEqual(['config', 'G-VVE0G4ZFL4']);
  });

  it('queues product events and records the first edit once', async () => {
    const { initializeAnalytics, trackAnalyticsEvent, trackFirstEdit } = await loadAnalytics();
    initializeAnalytics(true);
    trackAnalyticsEvent('chart_exported', { export_format: 'png', board_size_bucket: 'small', app_build: 'override' });
    trackFirstEdit();
    trackFirstEdit();

    expect(window.dataLayer?.slice(2).map((command) => Array.from(command))).toEqual([
      ['event', 'chart_exported', { export_format: 'png', board_size_bucket: 'small', app_build: __APP_BUILD__ }],
      ['event', 'first_edit', { app_build: __APP_BUILD__ }],
    ]);
  });
});
