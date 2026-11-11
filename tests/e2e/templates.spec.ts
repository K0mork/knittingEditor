import { fileURLToPath } from 'node:url';
import { expect, test } from './fixtures';

const TEMPLATES = ['seed', 'stockinette', 'rib-1x1', 'rib-2x2', 'cable-2x2', 'twist', 'nordic', 'checker'];

test('lists every template with a preview and a download link', async ({ page }) => {
  await page.goto('/templates/');
  await expect(page).toHaveTitle('編み図テンプレート｜棒針編み図エディタ');
  await expect(page.locator('article.template')).toHaveCount(TEMPLATES.length);

  for (const slug of TEMPLATES) {
    await expect(page.locator(`article.template img[src="/templates/${slug}.svg"]`)).toHaveCount(1);
    await expect(page.locator(`a[href="/templates/${slug}.knit"]`)).toHaveAttribute('download', '');
  }

  // プレビューはすべて読み込めている。
  expect(await page.locator('article.template img').evaluateAll(
    (images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true);
});

test('serves each template as a gzip backup', async ({ request }) => {
  for (const slug of TEMPLATES) {
    const response = await request.get(`/templates/${slug}.knit`);
    expect(response.status()).toBe(200);
    const body = await response.body();
    // gzipの先頭2バイト。`.knit`はgzip圧縮したJSONである。
    expect([body[0], body[1]]).toEqual([0x1f, 0x8b]);
  }
});

test('restores a downloaded template in the editor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '出力', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../../public/templates/seed.knit', import.meta.url)));

  await expect(page.getByText('1件の編み図を復元しました', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.app-header')).toContainText('鹿の子編み（復元）');
});
