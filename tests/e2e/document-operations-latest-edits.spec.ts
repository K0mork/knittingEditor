import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await expect(page.locator('.document-list')).toBeVisible();
});

for (const action of ['reselect', 'duplicate'] as const) {
  test(`preserves just-drawn cells on ${action} before autosave and after reload`, async ({ page }) => {
    // 描画と一覧のクリックを同じJavaScriptタスクで行い、400msの保存待ち時間に左右されない。
    await page.evaluate((action) => {
      const canvas = document.querySelector<HTMLCanvasElement>('.board-canvas')!;
      canvas.setPointerCapture = () => {};
      const rect = canvas.getBoundingClientRect();
      for (const [x, y] of [[75, 75], [135, 105]]) {
        for (const type of ['pointerdown', 'pointerup']) {
          canvas.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse',
            clientX: rect.left + x, clientY: rect.top + y, button: 0, isPrimary: true,
          }));
        }
      }
      const selector = action === 'reselect' ? '.document.active .document-open' : '.document.active .document-actions button[aria-label*="複製"]';
      document.querySelector<HTMLButtonElement>(selector)!.click();
    }, action);
    const canvas = page.getByLabel('編み図編集盤面');
    await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
    await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeEnabled();
    if (action === 'duplicate') {
      await expect(page.locator('.document')).toHaveCount(2);
      await page.locator('.document').filter({ hasText: 'のコピー' }).locator('.document-open').click();
      await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
      const box = (await canvas.boundingBox())!;
      await page.mouse.click(box.x + 195, box.y + 135);
      await expect(canvas).toHaveAttribute('aria-label', /記号3個/);
    }
    await expect(page.locator('.app-document-name')).not.toContainText('保存中');
    await page.reload();
    await expect(canvas).toHaveAttribute('aria-label', new RegExp(`記号${action === 'duplicate' ? 3 : 2}個`));
    if (action === 'duplicate') {
      await page.getByRole('button', { name: '編み図', exact: true }).click();
      await page.locator('.document').filter({ hasNotText: 'のコピー' }).locator('.document-open').click();
      await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
    }
  });
}

