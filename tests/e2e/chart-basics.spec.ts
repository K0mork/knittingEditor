import { expect, test } from './fixtures';

test('explains how to draw a chart and where to start', async ({ page }) => {
  const response = await page.goto('/chart-basics/');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('編み図の作り方｜描く手段の選び方とA4印刷｜棒針編み図エディタ');
  await expect(page.locator('h1')).toHaveText('編み図の作り方');
  await expect(page.locator('section.method')).toHaveCount(4);
  for (const heading of ['編み図を描く方法を選ぶ', '段数と目数を決める', 'A4に印刷する', 'よくあるつまずき', '描き始める']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }

  // 直接開いたURLのまま再読み込みできる。
  await page.reload();
  await expect(page.locator('h1')).toHaveText('編み図の作り方');
});

test('opens the editor and links both ways with the guide', async ({ page }) => {
  await page.goto('/chart-basics/');
  await page.getByRole('link', { name: '編み図エディタを開く', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();

  await page.goto('/guide/');
  await page.getByRole('link', { name: '編み図の作り方', exact: true }).click();
  await expect(page).toHaveURL(/\/chart-basics\/$/);
  await page.getByRole('link', { name: '使い方', exact: true }).first().click();
  await expect(page).toHaveURL(/\/guide\/$/);
});

test('does not scroll horizontally on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/chart-basics/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('section.method').first()).toBeVisible();
});
