import { expect, test } from '@playwright/test';

test('removes the editor footer and keeps the guide footer navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await expect(page.locator('footer')).toHaveCount(0);
  await page.getByRole('link', { name: '使い方', exact: true }).click();
  await expect(page).toHaveURL(/\/guide\/$/);
  const footer = page.locator('footer');
  await expect(footer).toBeVisible();
  await expect(footer.getByRole('link', { name: 'サポート・お問い合わせ', exact: true })).toBeVisible();
  await footer.getByRole('link', { name: '棒針編み図エディタへ戻る', exact: true }).click();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await expect(page.locator('footer')).toHaveCount(0);
});
