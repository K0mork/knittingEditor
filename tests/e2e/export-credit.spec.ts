import { readFileSync } from 'node:fs';
import { downloadInsteadOfShare, expect, test } from './fixtures';

test('adds the credit to PNG by default and removes it when turned off', async ({ page }) => {
  await downloadInsteadOfShare(page);
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '出力', exact: true }).click();
  const option = page.getByRole('checkbox', { name: 'クレジットを入れる（サイト名・URL・QRコード）' });
  await expect(option).toBeChecked();
  const sizeText = () => page.getByText(/^\d+×\d+px/).textContent();
  const withCredit = await sizeText();

  const heights: number[] = [];
  for (const enabled of [true, false]) {
    await option.setChecked(enabled);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGを保存', exact: true }).click();
    const png = await download;
    expect(await png.failure()).toBeNull();
    const bytes = readFileSync((await png.path())!);
    heights.push(bytes.readUInt32BE(20));
  }
  // クレジットの帯のぶん、既定のPNGは後ろより高い。
  expect(heights[0]).toBeGreaterThan(heights[1]);
  expect(withCredit).toContain(`×${heights[0]}px`);
  expect(await sizeText()).toContain(`×${heights[1]}px`);

  // 外したままPDFを保存しても、これまでどおり出力できる。
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDFを保存', exact: true }).click();
  expect(await (await download).failure()).toBeNull();
});
