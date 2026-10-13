import { gzipSync, strToU8 } from 'fflate';
import { expect, test, type Page } from './fixtures';

async function stored(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const get = db.transaction('documents').objectStore('documents').getAll();
      return await new Promise<{ id: string; name: string; updatedAt: number; filled: number }[]>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result.map((item) => ({
          id: item.id, name: item.name, updatedAt: item.updatedAt, filled: new Uint32Array(item.cells).filter(Boolean).length,
        })));
        get.onerror = () => reject(get.error);
      });
    } finally { db.close(); }
  });
}

async function draw(page: Page, x: number) {
  const box = (await page.getByLabel('編み図編集盤面').boundingBox())!;
  await page.mouse.click(box.x + x, box.y + 75);
}

async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
}

test('keeps both tabs edits in separate charts and continues saving to the active conflict copy', async ({ page, context }) => {
  await open(page);
  const original = (await stored(page))[0];
  const other = await context.newPage();
  await open(other);
  await draw(page, 75);
  await expect.poll(async () => (await stored(page)).find((item) => item.id === original.id)?.filled).toBe(1);
  await draw(other, 125);
  await expect(other.getByText(/別のタブで変更されたため、この編集を/)).toBeVisible();
  await expect(other.locator('.app-document-name')).toContainText(`${original.name}（別のタブの編集）`);
  await expect.poll(async () => (await stored(page)).length).toBe(2);
  expect((await stored(page)).find((item) => item.id === original.id)?.filled).toBe(1);
  const copy = (await stored(page)).find((item) => item.id !== original.id)!;
  expect(copy.filled).toBe(1);
  await draw(other, 175);
  await expect.poll(async () => (await stored(page)).find((item) => item.id === copy.id)?.filled).toBe(2);
  expect(await stored(page)).toHaveLength(2);
  await other.reload();
  await expect(other.locator('.app-document-name')).toContainText(copy.name);
});

test('does not resurrect a chart deleted in another tab', async ({ page, context }) => {
  await open(page);
  const other = await context.newPage();
  await open(other);
  const original = (await stored(page))[0];
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await page.getByRole('button', { name: '新しい編み図を複製', exact: true }).click();
  await expect(page.locator('.document')).toHaveCount(2);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.document').filter({ has: page.locator('.document-name', { hasText: /^新しい編み図$/ }) })
    .getByRole('button', { name: '新しい編み図を削除', exact: true }).click();
  await expect.poll(async () => (await stored(page)).some((item) => item.id === original.id)).toBe(false);
  await draw(other, 75);
  await expect(other.getByText(/別のタブで変更されたため、この編集を/)).toBeVisible();
  await expect.poll(async () => (await stored(page)).some((item) => item.name === `${original.name}（別のタブの編集）`)).toBe(true);
  expect((await stored(page)).some((item) => item.id === original.id)).toBe(false);
});

test('restores original update order and keeps equal-date order after reload', async ({ page }) => {
  await open(page);
  const documents = [
    { name: '古い', updatedAt: 100, createdAt: 10 },
    { name: '同時B', updatedAt: 200, createdAt: 20 },
    { name: '新しい', updatedAt: 300, createdAt: 30 },
    { name: '同時A', updatedAt: 200, createdAt: 20 },
  ].map((item) => ({ ...item, rows: 1, cols: 1, cells: 'AAAAAA==' }));
  const buffer = Buffer.from(gzipSync(strToU8(JSON.stringify({ format: 'knitting-editor', version: 2, documents, blocks: [] }))));
  await page.getByRole('button', { name: '出力', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: 'dates.knit', mimeType: 'application/gzip', buffer });
  await expect(page.getByText('4件の編み図を復元しました')).toBeVisible();
  async function assertOrder() {
    await page.getByRole('button', { name: '編み図', exact: true }).click();
    await expect(page.locator('.document-name')).toHaveText([
      '新しい編み図', '新しい（復元）', '同時A（復元）', '同時B（復元）', '古い（復元）',
    ]);
  }
  await assertOrder();
  const restored = (await stored(page)).filter((item) => item.name.endsWith('（復元）'));
  expect(restored.find((item) => item.name === '新しい（復元）')?.updatedAt).toBe(300);
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await assertOrder();
});

test('does not write an all-data backup beyond the restore limit', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = db.transaction('documents', 'readwrite');
      for (let index = 0; index < 501; index++) {
        transaction.objectStore('documents').put({
          id: `bulk-${index}`, name: `大量${index}`, rows: 1, cols: 1, cells: new Uint32Array(1).buffer, createdAt: 1, updatedAt: 1 + index,
        });
      }
      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.getByRole('button', { name: '出力', exact: true }).click();
  const status = page.getByText('この編み図はまだバックアップしていません。');
  await expect(status).toBeVisible();
  await page.getByRole('button', { name: '全データを書き出す', exact: true }).click();
  await expect(page.getByText('バックアップの上限を超えています。編み図を個別に書き出すか、不要な編み図を削除してください。')).toBeVisible();
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
  await expect(status).toBeVisible();
  expect(await stored(page)).toHaveLength(502);
});
