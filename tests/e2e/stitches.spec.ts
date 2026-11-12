import { expect, test } from './fixtures';

test('lists every stitch symbol in the app order', async ({ page }) => {
  const response = await page.goto('/stitches/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('編み目記号の一覧｜棒針編み図エディタ');
  await expect(page.locator('h1')).toHaveText('編み目記号の一覧');
  await expect(page.locator('article.stitch')).toHaveCount(29);
  await expect(page.locator('section.category')).toHaveCount(5);
  await expect(page.locator('section#basic h2')).toHaveText('基本の記号（7）');
  await expect(page.locator('section#utility h2')).toHaveText('補助の記号（1）');
  await expect(page.locator('article.stitch').first().locator('h3')).toHaveText('表目');
  await expect(page.locator('article.stitch').last().locator('h3')).toHaveText('白くする');

  // 記号の絵は、どの記事でも大きさを持って描かれている。
  const widths = await page.locator('article.stitch .symbol svg').evaluateAll(
    (nodes) => nodes.map((node) => node.getBoundingClientRect().width),
  );
  expect(widths).toHaveLength(29);
  expect(widths.every((width) => width > 20)).toBe(true);

  // 直接開いたURLのまま再読み込みできる。
  await page.reload();
  await expect(page.locator('h1')).toHaveText('編み目記号の一覧');
});

test('jumps to a category and opens the editor', async ({ page }) => {
  await page.goto('/stitches/');
  await page.locator('.toc a[href="#cable"]').click();
  await expect(page).toHaveURL(/#cable$/);
  await expect(page.locator('section#cable')).toBeInViewport();

  await page.getByRole('link', { name: '編み図エディタを開く' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

test('is linked from the editor page, the guide and the template gallery', async ({ page }) => {
  // トップページのリンクは、JavaScriptで描き替える前のHTMLにある（検索から来た人と、noscriptのため）。
  const home = await (await page.request.get('/')).text();
  expect(home).toContain('<a href="/stitches/">編み目記号の一覧</a>');

  await page.goto('/guide/');
  await page.getByRole('link', { name: '編み目記号の一覧' }).click();
  await expect(page).toHaveURL(/\/stitches\/$/);

  await page.goto('/templates/');
  await page.getByRole('link', { name: '編み目記号の一覧' }).click();
  await expect(page).toHaveURL(/\/stitches\/$/);
});

test('does not scroll horizontally on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/stitches/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('article.stitch .symbol svg').first()).toBeVisible();
});
