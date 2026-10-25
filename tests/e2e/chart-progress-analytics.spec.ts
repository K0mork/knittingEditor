import { readFileSync } from 'node:fs';
import { downloadInsteadOfShare, expect, test } from './fixtures';

const PROGRESS_KEY = 'knitting-editor:chart-progress:v1';

test('keeps automated editing and PNG export free of analytics state and requests', async ({ page, context }) => {
  const analyticsRequests: string[] = [];
  context.on('request', (request) => {
    if (/(^|\.)(googletagmanager\.com|google-analytics\.com)$/.test(new URL(request.url()).hostname)) {
      analyticsRequests.push(request.url());
    }
  });
  await downloadInsteadOfShare(page);
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  expect(await page.evaluate(() => navigator.webdriver)).toBe(true);
  // 初期表示の盤面で、横に並ぶ30pxのセルの中心を3つ押す。
  for (const x of [195, 225, 255]) await canvas.click({ position: { x, y: 135 } });
  await expect(canvas).toHaveAttribute('aria-label', /記号3個/);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-label', /記号3個/);

  expect(await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY)).toBeNull();
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept('計測除外テスト'));
  await page.getByRole('button', { name: '新しい編み図', exact: true }).click();
  await expect(page.locator('.app-document-name')).toContainText('計測除外テスト');
  await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
  // 作成時は一覧が閉じる。元の編み図へ戻り、編集内容を出力する。
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await page.locator('.document').filter({ hasNotText: '計測除外テスト' }).locator('.document-open').click();
  await expect(canvas).toHaveAttribute('aria-label', /記号3個/);
  await page.getByRole('button', { name: '出力', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGを保存', exact: true }).click();
  const png = await download;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  expect(await png.failure()).toBeNull();
  expect(readFileSync((await png.path())!).subarray(1, 4).toString()).toBe('PNG');
  expect(await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY)).toBeNull();
  // 非表示・再読込時のflushでも計測状態が残らない。
  await page.reload();
  await expect(canvas).toHaveAttribute('aria-label', /記号3個/);
  expect(await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY)).toBeNull();
  expect(analyticsRequests).toEqual([]);
});

test('removes existing progress state when analytics is opted out', async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem('knitting-editor:analytics-opt-out', '1');
    localStorage.setItem(key, JSON.stringify({ v: 1, charts: {} }));
    localStorage.setItem('chart-progress-test:unrelated', 'keep');
  }, PROGRESS_KEY);
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('knitting-editor:analytics-opt-out'))).toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('chart-progress-test:unrelated'))).toBe('keep');
});
