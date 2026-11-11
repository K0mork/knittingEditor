import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSetting } from '@knitting-editor/editor-core/storage/database';
import {
  APP_STORE_NOTICE_DISMISSED_KEY, APP_STORE_URL, AppStoreNotice, MINIMUM_IOS_MAJOR_VERSION, iosMajorVersion, shouldOfferIosApp, useAppStoreNotice,
} from './appStoreNotice';
import iosProject from '../ios/project.yml?raw';

const settings = vi.hoisted(() => ({ values: new Map<string, unknown>(), failReads: false }));
const analytics = vi.hoisted(() => ({ trackLinkClick: vi.fn() }));
vi.mock('./analytics', () => analytics);
vi.mock('@knitting-editor/editor-core/storage/database', () => ({
  getSetting: vi.fn(async (key: string) => {
    if (settings.failReads) throw new Error('blocked');
    return settings.values.get(key);
  }),
  setSetting: vi.fn(async (key: string, value: unknown) => { settings.values.set(key, value); }),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const IPHONE_IOS_18 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPHONE_IOS_16 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7_10 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
// OSの版が固定され、Safariの版だけが新しい名乗り。
const IPHONE_FROZEN_OS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME_IOS_17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1';
// iPadOSのSafariはMacの名乗りをする。
const IPAD_SAFARI_17 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const MAC_LIKE_WITHOUT_VERSION = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';
const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const WINDOWS_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const device = (userAgent: string, maxTouchPoints = 5, webdriver = false) => ({ userAgent, maxTouchPoints, webdriver });

describe('iosMajorVersion', () => {
  it.each([
    [IPHONE_IOS_18, 18],
    [IPHONE_IOS_16, 16],
    [IPHONE_FROZEN_OS, 26],
    [IPHONE_CHROME_IOS_17, 17],
    [IPAD_SAFARI_17, 17],
    [MAC_LIKE_WITHOUT_VERSION, undefined],
  ])('reads %s as %s', (userAgent, expected) => {
    expect(iosMajorVersion(userAgent)).toBe(expected);
  });
});

describe('shouldOfferIosApp', () => {
  it.each([
    ['iPhone Safari on iOS 18', device(IPHONE_IOS_18), true],
    ['iPhone Safari with a frozen OS version', device(IPHONE_FROZEN_OS), true],
    ['Chrome on iPhone', device(IPHONE_CHROME_IOS_17), true],
    ['iPad Safari, which names itself a Mac', device(IPAD_SAFARI_17), true],
    ['an iPad whose version cannot be read', device(MAC_LIKE_WITHOUT_VERSION), true],
    ['an iPhone that cannot run the app', device(IPHONE_IOS_16), false],
    ['Safari on a Mac', device(IPAD_SAFARI_17, 0), false],
    ['Android', device(ANDROID_CHROME), false],
    ['Windows', device(WINDOWS_CHROME, 0), false],
    ['an automated browser', device(IPHONE_IOS_18, 5, true), false],
  ])('%s → %s', (_name, nav, expected) => {
    expect(shouldOfferIosApp(nav)).toBe(expected);
  });

  it('uses the oldest iOS version the app supports', () => {
    const target = /deploymentTarget:\s*\n\s*iOS:\s*"(\d+)\./.exec(iosProject)?.[1];
    expect(Number(target)).toBe(MINIMUM_IOS_MAJOR_VERSION);
  });
});

describe('useAppStoreNotice', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;
  const preventNavigation = (event: MouseEvent) => event.preventDefault();

  beforeEach(() => {
    settings.values.clear();
    settings.failReads = false;
    analytics.trackLinkClick.mockReset();
    vi.mocked(getSetting).mockClear();
    container = document.createElement('div');
    document.body.append(container);
    // jsdomは新しいタブを開けないので、リンクの既定の動作だけ止める。Reactのクリック処理は動く。
    document.addEventListener('click', preventNavigation);
  });
  afterEach(async () => {
    await unmount();
    container.remove();
    document.removeEventListener('click', preventNavigation);
  });

  function Host({ nav }: { nav: ReturnType<typeof device> }) {
    const { shown, dismiss } = useAppStoreNotice(nav);
    return shown ? <AppStoreNotice onDismiss={dismiss} /> : null;
  }

  async function render(nav: ReturnType<typeof device>) {
    await act(async () => {
      root = createRoot(container);
      root.render(<Host nav={nav} />);
    });
    // 閉じた記録の読み込みを待つ。
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }

  async function unmount() {
    if (!root) return;
    const current = root;
    root = undefined;
    await act(async () => current.unmount());
  }

  const notice = () => container.querySelector<HTMLElement>('[aria-label="アプリの案内"]');
  const control = (label: string) => [...container.querySelectorAll<HTMLElement>('a, button')].find((element) => element.textContent === label)!;

  it('offers the app until it is closed and never again on that device', async () => {
    await render(device(IPHONE_IOS_18));
    expect(notice()?.textContent).toContain('iPhone・iPad版のアプリがあります。');
    expect(notice()?.textContent).toContain('Web版の編み図は.knitバックアップで移せます。');
    const link = control('App Storeで見る');
    expect(link.getAttribute('href')).toBe(APP_STORE_URL);
    expect(link.getAttribute('target')).toBe('_blank');
    // App Store Connectの参照元の集計に残すため、参照元を消さない。
    expect(link.getAttribute('rel')).toBe('noopener');

    await act(async () => control('閉じる').click());
    expect(notice()).toBeNull();
    expect(settings.values.get(APP_STORE_NOTICE_DISMISSED_KEY)).toEqual(expect.any(Number));

    await unmount();
    await render(device(IPHONE_IOS_18));
    expect(notice()).toBeNull();
  });

  it('records the notice as seen and the link click when the App Store is opened from it', async () => {
    await render(device(IPAD_SAFARI_17));
    await act(async () => control('App Storeで見る').click());
    expect(notice()).toBeNull();
    expect(settings.values.has(APP_STORE_NOTICE_DISMISSED_KEY)).toBe(true);
    expect(analytics.trackLinkClick).toHaveBeenCalledWith('app_store');
  });

  it('does not record a link click when the notice is only closed', async () => {
    await render(device(IPAD_SAFARI_17));
    await act(async () => control('閉じる').click());
    expect(analytics.trackLinkClick).not.toHaveBeenCalled();
  });

  it('does not read the record on devices that cannot install the app', async () => {
    await render(device(WINDOWS_CHROME, 0));
    expect(notice()).toBeNull();
    expect(getSetting).not.toHaveBeenCalled();
  });

  it('stays hidden when the record cannot be read', async () => {
    settings.failReads = true;
    await render(device(IPHONE_IOS_18));
    expect(getSetting).toHaveBeenCalledWith(APP_STORE_NOTICE_DISMISSED_KEY);
    expect(notice()).toBeNull();
  });
});
