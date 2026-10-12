import { expect, test } from './fixtures';

test('expands a released selection through a slip-stitch chain and copies the whole chain', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: '編み目記号を選ぶ' }).click();
  await page.getByRole('dialog', { name: '編み目記号' }).getByRole('button', { name: /^すべり目/ }).click();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  // 初期表示の原点36px、セル幅30px。1〜3行目に交互の列で2段の記号を置く。
  const point = (row: number, col: number) => ({
    x: box!.x + 36 + col * 30 + 15,
    y: box!.y + 36 + row * 30 + 15,
  });
  for (let row = 0; row < 3; row++) {
    const { x, y } = point(row, row % 2);
    await page.mouse.click(x, y);
  }
  await expect(canvas).toHaveAttribute('aria-label', /記号3個/);
  await page.getByRole('button', { name: '範囲', exact: true }).click();
  const start = point(3, 0);
  const end = point(3, 1);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('aria-label', /選択範囲は4段、2目/);
  await page.getByRole('button', { name: 'コピーして貼付' }).click();
  const target = point(5, 2);
  await page.mouse.click(target.x, target.y);
  await expect(page.getByText('ブロックを貼り付けました')).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', /記号6個/);
});
