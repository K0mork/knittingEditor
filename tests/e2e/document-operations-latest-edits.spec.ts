import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await expect(page.locator('.document-list')).toBeVisible();
});

for (const action of ['reselect', 'duplicate'] as const) {
  test(`preserves just-drawn cells on ${action} before autosave and after reload`, { tag: '@wide' }, async ({ page }) => {
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
      // 元の編み図も記号2個なので、切り替えの完了を名前で待ってから描く。
      // 切り替え前に描くと元の編み図に入り、保存中の編集として切り替えが取りやめられる。
      await expect(page.locator('.app-document-name')).toContainText('のコピー');
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

/*
 * 作成・名前変更・複製・削除の失敗は、`packages/editor-core/ui/useEditorController.ts`の
 * `runManagementOperation`が同じ通知経路で扱う。同じ経路を4回通さず、削除だけで確かめる。
 */
test('notifies delete failure without changing the document list', { tag: '@wide' }, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.locator('.document.active .document-actions').getByRole('button', { name: /を複製$/ }).click();
  await expect(page.locator('.document')).toHaveCount(2);
  const names = await page.locator('.document-name').allTextContents();
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    const originalDelete = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'documents') throw new DOMException('test quota', 'QuotaExceededError');
      return originalPut.apply(this, args);
    };
    IDBObjectStore.prototype.delete = function (...args) {
      if (this.name === 'documents') throw new DOMException('test quota', 'QuotaExceededError');
      return originalDelete.apply(this, args);
    };
  });
  page.once('dialog', (dialog) => dialog.accept());
  // 操作ボタンの名前は「<編み図名>を削除」。
  await page.locator('.document.active .document-actions').getByRole('button', { name: /を削除$/ }).click();
  await expect(page.locator('.toast')).toContainText('編み図の削除に失敗しました');
  expect(await page.locator('.document-name').allTextContents()).toEqual(names);
  await expect(page.locator('.app-document-name')).toContainText('新しい編み図');
  expect(errors).toEqual([]);
});
