import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebPlatform, prefersShareSheet, SHARE_CREDIT, shareData } from './platform';

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

describe('shareData', () => {
  it('adds the site name and URL to the file share payload', () => {
    // 文面は受け取った人がサイトへたどれるためのもので、編み図の内容やファイル名は含まない。
    const canShare = vi.fn(() => true);
    expect(shareData(pdf, fakeNavigator(IPHONE, 5, canShare))).toEqual({ files: [pdf], ...SHARE_CREDIT });
    // canShareは渡す内容そのもので確かめる。
    expect(canShare).toHaveBeenCalledWith({ files: [pdf], ...SHARE_CREDIT });
    expect(SHARE_CREDIT.title).toBe('棒針編み図エディタ');
    expect(SHARE_CREDIT.text).toBe('棒針編み図エディタで作成 https://knittingeditor.com/');
  });

  it('falls back to the file alone when the browser rejects text alongside files', () => {
    // 文面付きで共有できないと共有自体が失敗するので、そのときは従来どおりファイルだけを渡す。
    const canShare = vi.fn((data: ShareData) => data.title === undefined && data.text === undefined);
    const nav = fakeNavigator(IPHONE, 5, canShare);
    expect(shareData(pdf, nav)).toEqual({ files: [pdf] });
    // ファイルだけなら共有できるので、共有シートの導線は保つ。
    expect(prefersShareSheet(pdf, nav)).toBe(true);
    // canShareは渡す内容そのもので確かめる。文面付きは拒否され、最後はファイルだけの内容を確かめる。
    expect(canShare).toHaveBeenCalledWith({ files: [pdf], ...SHARE_CREDIT });
    expect(canShare).toHaveBeenLastCalledWith({ files: [pdf] });
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
