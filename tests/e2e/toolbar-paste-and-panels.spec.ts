import { expect, test } from './fixtures';

for (const width of [390, 430]) {
  test(`keeps range and paste controls visible with a long stitch name at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const canvas = page.getByLabel('編み図編集盤面');
    await expect(canvas).toBeVisible();
    await page.getByRole('button', { name: '編み目記号を選ぶ', exact: true }).click();
    await page.getByRole('dialog', { name: '編み目記号' }).getByRole('button', { name: /^右上2目交差/ }).click();
    await expect(page.locator('.stitch-tool')).toHaveAccessibleDescription('右上2目交差');
    const box = (await canvas.boundingBox())!;
    await page.getByRole('button', { name: '範囲', exact: true }).click();
    await page.mouse.move(box.x + 81, box.y + 81);
    await page.mouse.down();
    await page.mouse.move(box.x + 111, box.y + 111);
    await page.mouse.up();
    await page.getByRole('button', { name: 'コピーして貼付', exact: true }).click();
    for (const label of ['範囲', '貼付']) {
      const bounds = (await page.getByRole('button', { name: label, exact: true }).boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
    expect(await page.locator('.primary-tools').evaluate((row) => row.scrollWidth <= row.clientWidth)).toBe(true);
    const band = page.getByRole('toolbar', { name: '貼付の操作' });
    await expect(band).toContainText('貼付中：左上にするマスをタップ');
    await expect(page.locator('.toast')).toHaveCount(0);
    await expect(page.locator('.gesture-hint')).toHaveClass(/is-hidden/, { timeout: 12_000 });
    await expect(band).toBeVisible();
    const boardBounds = (await canvas.boundingBox())!;
    const bandBounds = (await band.boundingBox())!;
    expect(bandBounds.y + bandBounds.height).toBeLessThanOrEqual(boardBounds.y);
    await band.getByRole('button', { name: 'やめる' }).click();
    await expect(band).toHaveCount(0);
    await expect(page.getByRole('button', { name: '描く', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas).toHaveAttribute('aria-label', /描画モード/);
    await page.getByRole('button', { name: '貼付', exact: true }).click();
    await expect(band).toBeVisible();
    await expect(page.locator('.toast')).toHaveCount(0);
  });
}

test('shows export and document panels in a right column at 844x390', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  for (const label of ['出力', '編み図']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const drawer = page.locator('#app-drawer');
    await expect(drawer).toBeVisible();
    const box = (await drawer.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(422);
    expect(box.x + box.width).toBe(844);
    expect(box.y).toBe(64);
    expect(box.y + box.height).toBe(390);
    if (label === '出力') {
      for (const action of ['PNGを保存', 'PDFを保存', 'この編み図を書き出す', '全データを書き出す', 'バックアップから復元']) {
        const button = drawer.getByRole('button', { name: action, exact: true });
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeInViewport();
      }
    }
    await drawer.getByRole('button', { name: '閉じる', exact: true }).click();
  }
});

for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
  test(`keeps each backup button label on one line at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
    await page.getByRole('button', { name: '出力', exact: true }).click();
    const drawer = page.locator('#app-drawer');
    for (const action of ['この編み図を書き出す', '全データを書き出す', 'バックアップから復元']) {
      const button = drawer.getByRole('button', { name: action, exact: true });
      await button.scrollIntoViewIfNeeded();
      // 文字の行の上端を数え、語の途中で折り返していないことを確かめる。
      const lines = await button.evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
      });
      expect(lines, action).toBe(1);
    }
  });
}
