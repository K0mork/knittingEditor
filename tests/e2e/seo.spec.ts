import { expect, test, type Page } from '@playwright/test';

const OG_IMAGE_URL = 'https://knittingeditor.com/og-image.png';

async function expectAppIconLinks(page: Page) {
  await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute('href', '/favicon.ico');
  await expect(page.locator('link[rel="icon"][type="image/png"]')).toHaveAttribute('href', '/icon-192.png');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/apple-touch-icon.png');
}

async function expectLargeImageCard(page: Page) {
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', OG_IMAGE_URL);
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/png');
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute('content', '棒針の編み図 無料・登録不要');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
}

type StructuredDataNode = { '@type': string; url?: string; description?: string; isAccessibleForFree?: boolean; offers?: { price?: string; priceCurrency?: string } };

test('serves crawlable content before JavaScript runs', async ({ page }) => {
  const response = await page.request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<h1>無料で使える棒針編み図エディタ</h1>');
  expect(html).toContain('<p>登録不要で、スマホ・PCから使える無料の棒針編み図作成サイトです。26種類の編み目記号や色の編集、パターンブロック、PNG・PDF出力、端末内自動保存に対応しています。</p>');
  expect(html).toContain('<a href="/guide/">棒針編み図エディタの使い方</a>');
  expect(html).toContain('<a href="/privacy/">プライバシーポリシー</a>');
});

test('exposes search and sharing metadata on the editor page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('棒針編み図エディタ｜無料の編み図作成サイト');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://knittingeditor.com/');
  await expectAppIconLinks(page);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /登録不要で使える無料の棒針編み図作成サイト/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '棒針編み図エディタ｜無料の編み図作成サイト');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /登録不要.*PNG・PDF保存/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://knittingeditor.com/');
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ja_JP');
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', '棒針編み図エディタ');
  await expectLargeImageCard(page);
});

test('describes the site and the application as structured data', async ({ page }) => {
  await page.goto('/');
  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  expect(raw).not.toBeNull();
  const graph = (JSON.parse(raw!) as { '@graph': StructuredDataNode[] })['@graph'];
  const website = graph.find((node) => node['@type'] === 'WebSite');
  const application = graph.find((node) => node['@type'] === 'WebApplication');
  expect(website?.url).toBe('https://knittingeditor.com/');
  expect(application?.url).toBe('https://knittingeditor.com/');
  expect(application?.description).toContain('無料の棒針編み図作成サイト');
  expect(application?.isAccessibleForFree).toBe(true);
  expect(application?.offers?.price).toBe('0');
});

test('replaces the crawlable fallback with the editor after mounting', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('棒針編み図エディタ');
  await expect(page.locator('.app-tagline')).toHaveText('無料の棒針編み図作成サイト');
  await expect(page.locator('.app-tagline')).toBeVisible();
});

test('opens the guide from the editor header', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('link', { name: '使い方' }).click();
  await expect(page).toHaveURL(/\/guide\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ブラウザで棒針編み図を作る方法');
});

test('serves the guide page directly with its own metadata', async ({ page }) => {
  const response = await page.goto('/guide/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('棒針編み図の作り方｜棒針編み図エディタ');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://knittingeditor.com/guide/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /使い方/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ブラウザで棒針編み図を作る方法');
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '棒針編み図の作り方｜棒針編み図エディタ');
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /使い方/);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://knittingeditor.com/guide/');
  await expectLargeImageCard(page);
  await expectAppIconLinks(page);
  await page.getByRole('link', { name: '編み図を作成する' }).click();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

test('links the guide to the third-party license notices', async ({ page }) => {
  await page.goto('/guide/');
  await page.getByRole('link', { name: '第三者ソフトウェアのライセンス' }).click();
  await expect(page).toHaveURL(/\/third-party-notices\/$/);
  await expect(page).toHaveTitle('第三者ソフトウェアのライセンス｜棒針編み図エディタ');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  for (const name of ['fflate', 'idb', 'react', 'react-dom', 'scheduler']) {
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${name} `) })).toBeVisible();
  }
  await expect(page.getByText('Permission is hereby granted').first()).toBeVisible();
  await page.getByRole('link', { name: '使い方へ戻る' }).first().click();
  await expect(page).toHaveURL(/\/guide\/$/);
});

test('serves the support page with a private contact and links it from the guide', async ({ page }) => {
  await page.goto('/guide/');
  await page.getByRole('link', { name: 'サポート・お問い合わせ' }).click();
  await expect(page).toHaveURL(/\/support\/$/);
  await expect(page).toHaveTitle('サポート｜棒針編み図エディタ');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://knittingeditor.com/support/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://knittingeditor.com/support/');
  await expectLargeImageCard(page);
  await expectAppIconLinks(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('サポート');
  await expect(page.getByRole('link', { name: 'support@knittingeditor.com' })).toHaveAttribute('href', 'mailto:support@knittingeditor.com');
  await expect(page.getByRole('link', { name: 'GitHub Issues' })).toHaveAttribute('href', 'https://github.com/K0mork/knittingEditor/issues');
  await page.getByRole('link', { name: '使い方' }).click();
  await expect(page).toHaveURL(/\/guide\/$/);
});

test('serves the privacy policy directly and after a reload', async ({ page }) => {
  const response = await page.goto('/privacy/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('プライバシーポリシー｜棒針編み図エディタ');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://knittingeditor.com/privacy/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://knittingeditor.com/privacy/');
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expectLargeImageCard(page);
  await expectAppIconLinks(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('プライバシーポリシー');
  // 外部送信の公表事項（送信される情報、送信先、利用目的）と、Googleのポリシー・止める方法へのリンク。
  await expect(page.getByRole('heading', { level: 2, name: '外部送信（Google アナリティクス）について' })).toBeVisible();
  for (const term of ['送信先', '送信される情報', '利用目的']) await expect(page.getByRole('term').filter({ hasText: term })).toBeVisible();
  await expect(page.getByText('Google LLC（Google アナリティクス）')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Google アナリティクス オプトアウト アドオン' })).toHaveAttribute('href', 'https://tools.google.com/dlpage/gaoptout?hl=ja');
  await expect(page.getByRole('link', { name: 'Google プライバシー ポリシー' })).toHaveAttribute('href', 'https://policies.google.com/privacy?hl=ja');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('プライバシーポリシー');
  await page.getByRole('link', { name: 'サポート・お問い合わせ' }).click();
  await expect(page).toHaveURL(/\/support\/$/);
});

test('links the privacy policy from the guide and the support page', async ({ page }) => {
  for (const path of ['/guide/', '/support/']) {
    await page.goto(path);
    await page.getByRole('link', { name: 'プライバシーポリシー' }).click();
    await expect(page).toHaveURL(/\/privacy\/$/);
  }
});

test('publishes the guide, the support page and the privacy policy in the sitemap', async ({ page }) => {
  const sitemap = await page.request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain('<loc>https://knittingeditor.com/</loc>');
  expect(xml).toContain('<loc>https://knittingeditor.com/guide/</loc>');
  expect(xml).toContain('<loc>https://knittingeditor.com/support/</loc>');
  expect(xml).toContain('<loc>https://knittingeditor.com/privacy/</loc>');
});

test('serves the app icon as the favicon and touch icons', async ({ page }) => {
  const favicon = await page.request.get('/favicon.ico');
  expect(favicon.status()).toBe(200);
  const ico = await favicon.body();
  expect(ico.readUInt16LE(2)).toBe(1);
  expect(ico.readUInt16LE(4)).toBe(3);
  for (const [path, size] of [['/icon-192.png', 192], ['/apple-touch-icon.png', 180]] as const) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/png');
    const png = await response.body();
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
});

test('serves the sharing image as a 1200x630 PNG', async ({ page }) => {
  const response = await page.request.get(new URL(OG_IMAGE_URL).pathname);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
  const png = await response.body();
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});
