import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebPlatform, prefersShareSheet } from './platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_MODE = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

function fakeNavigator(userAgent: string, maxTouchPoints: number, canShare?: (data: ShareData) => boolean): Navigator {
  return { userAgent, maxTouchPoints, canShare } as unknown as Navigator;
}

const pdf = new File(['%PDF'], 'chart.pdf', { type: 'application/pdf' });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('prefersShareSheet', () => {
  it('uses the share sheet on iPhone and iPad Safari', () => {
    expect(prefersShareSheet(pdf, fakeNavigator(IPHONE, 5, () => true))).toBe(true);
    // iPadOSのSafariはMacを名乗るので、タッチ点の数で見分ける。
    expect(prefersShareSheet(pdf, fakeNavigator(IPAD_DESKTOP_MODE, 5, () => true))).toBe(true);
  });

  it('keeps downloading on desktop Safari, Android, and browsers without file sharing', () => {
    expect(prefersShareSheet(pdf, fakeNavigator(IPAD_DESKTOP_MODE, 0, () => true))).toBe(false);
    expect(prefersShareSheet(pdf, fakeNavigator(ANDROID, 5, () => true))).toBe(false);
    expect(prefersShareSheet(pdf, fakeNavigator(IPHONE, 5))).toBe(false);
    expect(prefersShareSheet(pdf, fakeNavigator(IPHONE, 5, () => false))).toBe(false);
  });
});

describe('createWebPlatform', () => {
  it('offers the generated file for sharing instead of replacing the page on iPhone', async () => {
    vi.stubGlobal('navigator', fakeNavigator(IPHONE, 5, () => true));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let answer!: (result: boolean | undefined) => void;
    const offerShare = vi.fn((_file: File) => new Promise<boolean | undefined>((resolve) => { answer = resolve; }));

    const { saved } = await createWebPlatform(offerShare).saveFile(new Blob(['%PDF'], { type: 'application/pdf' }), 'chart.pdf');

    expect(offerShare).toHaveBeenCalledOnce();
    const file = offerShare.mock.calls[0][0];
    expect([file.name, file.type]).toEqual(['chart.pdf', 'application/pdf']);
    expect(click).not.toHaveBeenCalled();
    // 確認ダイアログで取りやめたことを、呼び出し側へ返す。
    answer(false);
    await expect(saved).resolves.toBe(false);
  });

  it('downloads the file directly elsewhere', async () => {
    vi.stubGlobal('navigator', fakeNavigator(ANDROID, 5, () => true));
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:chart', revokeObjectURL: () => {} });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const offerShare = vi.fn(async (_file: File) => true);

    const { saved } = await createWebPlatform(offerShare).saveFile(new Blob(['%PDF'], { type: 'application/pdf' }), 'chart.pdf');

    expect(offerShare).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledOnce();
    // ダウンロードは保存を終えたかが分からない。
    await expect(saved).resolves.toBeUndefined();
  });
});
