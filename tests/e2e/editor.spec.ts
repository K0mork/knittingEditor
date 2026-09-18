import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '棒針編み図エディタ' })).toBeVisible();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

test('draws continuously and restores the board after reload', async ({ page }) => {
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.move(box!.x + 180, box!.y + 75, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const storedBefore = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('documents');
    const get = transaction.objectStore('documents').getAll();
    return await new Promise<number>((resolve) => { get.onsuccess = () => resolve(get.result[0].cells.byteLength); });
  });
  expect(storedBefore).toBe(1600);
  await page.reload();
  await expect(page.getByText('新しい編み図', { exact: false })).toBeVisible();
});

test('creates a block and exports backup and PDF', async ({ page }) => {
  await page.getByRole('button', { name: '範囲' }).click();
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  page.once('dialog', async (dialog) => dialog.accept('テストブロック'));
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.move(box!.x + 135, box!.y + 135);
  await page.mouse.up();
  await page.getByRole('button', { name: 'ブロック' }).click();
  await page.getByRole('button', { name: '選択範囲をブロック保存' }).click();
  await expect(page.getByText('テストブロック')).toBeVisible();

  await page.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'この編み図' }).click();
  expect((await backupDownload).suggestedFilename()).toMatch(/\.knit$/);

  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDFを保存' }).click();
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
});

test('resizes to one million cells without creating cell DOM nodes', async ({ page }) => {
  await page.getByRole('button', { name: '盤面' }).click();
  await page.getByLabel('段数').fill('1000');
  await page.getByLabel('列数').fill('1000');
  await page.getByRole('button', { name: '変更' }).click();
  await expect(page.locator('.board-canvas')).toHaveCount(1);
  expect(await page.locator('.cell').count()).toBe(0);
});
