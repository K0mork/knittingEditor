import { devices } from '@playwright/test';
import { expect, test, type Page } from './fixtures';

const APP_STORE_URL = 'https://apps.apple.com/jp/app/id6829961403';
/** アプリの案内はiPhone・iPadだけに出す。`webkit-mobile`はiPhone 14として動く。 */
const IPHONE_PROJECT = 'webkit-mobile';

/**
 * アプリの案内は自動操作のブラウザには出さないので、`navigator.webdriver`を偽にして人の操作に見せる。
 * そのままでは本番ビルドがGA4へ送ってしまうため、解析を止める設定を入れ、Googleへの通信も止める。
 * App Storeの製品ページも外へ取りに行かず、ここで返す。
 */
async function openAsPerson(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false, configurable: true });
    localStorage.setItem('knitting-editor:analytics-opt-out', '1');
  });
  await page.context().route(/^https:\/\/([^/]+\.)?(googletagmanager\.com|google-analytics\.com|analytics\.google\.com)\//, (route) => route.abort());
  await page.context().route(/^https:\/\/apps\.apple\.com\//, (route) => route.fulfill({ contentType: 'text/html', body: '<title>App Store</title>' }));
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
}

/** 閉じた記録（`src/appStoreNotice.tsx`の`APP_STORE_NOTICE_DISMISSED_KEY`）を、端末内のIndexedDBから読む。 */
function readDismissedAt(page: Page) {
  return page.evaluate(() => new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open('knitting-editor-v2');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction('settings').objectStore('settings').get('appStoreNoticeDismissedAt');
      get.onsuccess = () => { database.close(); resolve((get.result as { value?: unknown } | undefined)?.value); };
      get.onerror = () => { database.close(); reject(get.error); };
    };
  }));
}

test('offers the iPhone and iPad app above the board until it is closed', async ({ page }, testInfo) => {
  await openAsPerson(page);
  const notice = page.getByRole('region', { name: 'アプリの案内' });
  if (testInfo.project.name !== IPHONE_PROJECT) {
    // AndroidとPCには出さない。端末で決まるので、記録の読み込みを待たずに決まる。
    await expect(notice).toHaveCount(0);
    return;
  }

  await expect(notice).toBeVisible();
  await expect(notice).toContainText('iPhone・iPad版のアプリがあります。');
  await expect(notice).toContainText('Web版の編み図は.knitバックアップで移せます。');
  const link = notice.getByRole('link', { name: 'App Storeで見る' });
  await expect(link).toHaveAttribute('href', APP_STORE_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  // 盤面には重ねず、道具の列と盤面の間（書き出しの勧めと同じ段）に置く。
  const [tools, box, canvas] = await Promise.all([
    page.locator('.primary-tools').boundingBox(), notice.boundingBox(), page.locator('.canvas-wrap').boundingBox(),
  ]);
  expect(box!.y).toBeGreaterThanOrEqual(tools!.y + tools!.height - 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(canvas!.y + 1);
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(34);

  await notice.getByRole('button', { name: '閉じる' }).click();
  await expect(notice).toHaveCount(0);
  await expect.poll(() => readDismissedAt(page)).toEqual(expect.any(Number));

  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  // 閉じた記録を読み終える時間を置いても、二度と出ない。
  await page.waitForTimeout(1_000);
  await expect(notice).toHaveCount(0);
});

test.describe('with an iPhone user agent in every browser', () => {
  test.use({ userAgent: devices['iPhone 14'].userAgent });

  test('opens the App Store from the notice, keeps the editor tab and does not offer it again', async ({ page }, testInfo) => {
    await openAsPerson(page);
    const notice = page.getByRole('region', { name: 'アプリの案内' });
    const editorUrl = page.url();

    // WebKitはSafariと同じくApp Storeの製品ページへのリンクをApp Storeへ渡し、タブを開かない。
    // 新しいタブで開くことはChromiumで確かめ、WebKitでは案内が閉じて編集中のタブが残ることだけ確かめる。
    const opening = testInfo.project.name.startsWith('webkit') ? undefined : page.waitForEvent('popup');
    await notice.getByRole('link', { name: 'App Storeで見る' }).click();
    if (opening) {
      const store = await opening;
      await expect(store).toHaveURL(APP_STORE_URL);
      await store.close();
    }
    await expect(notice).toHaveCount(0);
    expect(page.url()).toBe(editorUrl);
    await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
    await expect.poll(() => readDismissedAt(page)).toEqual(expect.any(Number));

    await page.reload();
    await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
    await page.waitForTimeout(1_000);
    await expect(notice).toHaveCount(0);
  });
});

test('links the app from the chart panel above the privacy policy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  const drawer = page.locator('#app-drawer');
  const link = drawer.getByRole('link', { name: 'iPhone・iPad版アプリ（App Store）' });
  await expect(link).toHaveAttribute('href', APP_STORE_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  // スマホの幅でも、編み図が1件ならパネルを開いただけで見える位置にある。
  await expect(link).toBeInViewport();
  const privacy = drawer.getByRole('link', { name: 'プライバシーポリシー（アクセス解析について）' });
  await expect(privacy).toBeInViewport();
  // 並んだリンクを指で押し分けられるだけ離す。
  const [appBox, privacyBox] = await Promise.all([link.boundingBox(), privacy.boundingBox()]);
  expect(privacyBox!.y - appBox!.y).toBeGreaterThanOrEqual(24);
});

for (const path of ['/guide/', '/support/']) {
  test(`shows one App Store badge with Apple's trademark notice on ${path}`, async ({ page }) => {
    await page.goto(path);
    const badge = page.getByRole('link', { name: 'App Storeからダウンロード' });
    await expect(badge).toHaveCount(1);
    await expect(badge).toHaveAttribute('href', APP_STORE_URL);
    const image = badge.locator('img');
    await expect(image).toHaveAttribute('src', '/app-store-badge.svg');
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    // Appleの指定では、画面上の高さは40px以上。縦横比は配布されたバッジのまま。
    const box = (await image.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(40);
    expect(box.width / box.height).toBeCloseTo(108.85157 / 40, 1);
    // アプリには空の状態から始まるので、編み図の移し方を添える。
    await expect(page.locator('main')).toContainText('アプリの「出力」にある「バックアップから復元」で読み込むと移せます。');
    const footer = page.locator('footer');
    await expect(footer).toContainText('Apple、Appleのロゴ、iPhone、iPadは、米国およびその他の国で登録されたApple Inc.の商標です。');
    await expect(footer).toContainText('App Storeは、米国およびその他の国で登録されたApple Inc.のサービスマークです。');
  });
}

test('serves the App Store badge as an SVG image', async ({ request }) => {
  const response = await request.get('/app-store-badge.svg');
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
});
