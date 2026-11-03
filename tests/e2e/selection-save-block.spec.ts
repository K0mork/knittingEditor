import { expect, test } from './fixtures';

test('saves a selection as a block from the selection toolbar without opening the panel', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: '範囲', exact: true }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 75, box.y + 75);
  await page.mouse.down();
  await page.mouse.move(box.x + 135, box.y + 135);
  await page.mouse.up();
  const toolbar = page.getByRole('toolbar', { name: '選択範囲の操作' });
  await expect(toolbar).toBeVisible();

  // 名前の入力を断ると保存せず、選んだ範囲も残る。
  page.once('dialog', async (dialog) => dialog.dismiss());
  await toolbar.getByRole('button', { name: '選択範囲をブロックに保存', exact: true }).click();
  await expect(toolbar).toBeVisible();

  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe('ブロック名を入力してください');
    await dialog.accept('操作帯から保存');
  });
  await toolbar.getByRole('button', { name: '選択範囲をブロックに保存', exact: true }).click();
  await expect(page.getByText('ブロックを保存しました')).toBeVisible();
  await expect(toolbar).toHaveCount(0);
  // 道具は範囲選択のまま、選択だけが外れる。
  await expect(page.getByRole('button', { name: '範囲', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', /範囲選択モード。選択範囲なし/);

  await page.getByRole('button', { name: 'ブロック', exact: true }).click();
  await expect(page.locator('.block-list').getByRole('button', { name: /操作帯から保存/ })).toBeVisible();
  // 再読み込みしても端末内に残る。
  await page.reload();
  await page.getByRole('button', { name: 'ブロック', exact: true }).click();
  await expect(page.locator('.block-list').getByRole('button', { name: /操作帯から保存/ })).toBeVisible();
});
