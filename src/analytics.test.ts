import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadAnalytics() {
  return import('./analytics');
}

beforeEach(() => {
  vi.resetModules();
  document.head.innerHTML = '';
  delete window.dataLayer;
});

describe('analytics', () => {
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
    expect(window.dataLayer?.[1]).toEqual(['config', 'G-VVE0G4ZFL4']);
  });

  it('queues product events and records the first edit once', async () => {
    const { initializeAnalytics, trackAnalyticsEvent, trackFirstEdit } = await loadAnalytics();
    initializeAnalytics(true);
    trackAnalyticsEvent('chart_exported', { export_format: 'png', board_size_bucket: 'small' });
    trackFirstEdit();
    trackFirstEdit();

    expect(window.dataLayer?.slice(2)).toEqual([
      ['event', 'chart_exported', { export_format: 'png', board_size_bucket: 'small' }],
      ['event', 'first_edit', {}],
    ]);
  });

  it('uses stable low-cardinality buckets', async () => {
    const { boardSizeBucket, countBucket } = await loadAnalytics();

    expect([boardSizeBucket(20, 20), boardSizeBucket(50, 50), boardSizeBucket(100, 100), boardSizeBucket(101, 100)]).toEqual([
      'small', 'medium', 'large', 'xlarge',
    ]);
    expect([countBucket(1), countBucket(3), countBucket(9), countBucket(10)]).toEqual(['1', '2-3', '4-9', '10+']);
  });
});
