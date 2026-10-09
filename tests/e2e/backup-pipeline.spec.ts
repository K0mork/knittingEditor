import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

test('exports and restores the latest cells while storage keeps failing', async ({ page }) => {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Object.assign(window, { restorePut: () => { IDBObjectStore.prototype.put = original; } });
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'documents') throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  const canvas = page.getByLabel('編み図編集盤面');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + 75, box.y + 75);
  await expect(page.getByRole('alert').filter({ hasText: '端末内への保存に失敗しています' })).toBeVisible();
  await expect(page.locator('.app-header')).toContainText('保存失敗');
  await page.waitForTimeout(5_000);
  await expect(page.getByRole('alert').filter({ hasText: '端末内への保存に失敗しています' })).toBeVisible();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'この編み図', exact: true }).click();
  const file = await pending;
  const path = (await file.path())!;
  const payload = JSON.parse(gunzipSync(await readFile(path)).toString());
  const bytes = Buffer.from(payload.documents[0].cells, 'base64');
  expect(bytes.some((value: number) => value !== 0)).toBe(true);
  await page.evaluate(() => (window as unknown as { restorePut: () => void }).restorePut());
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText('1件の編み図を復元しました', { exact: true })).toBeVisible();
  const cells = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const get = db.transaction('documents').objectStore('documents').getAll();
    const docs = await new Promise<Array<{ name: string; cells: ArrayBuffer }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    db.close();
    return Array.from(new Uint8Array(docs.find((item) => item.name.endsWith('（復元）'))!.cells));
  });
  expect(cells).toEqual(Array.from(bytes));
});

test('keeps the exported generation unrecorded when undo runs during file handoff', async ({ page }) => {
  // ファイル受け渡しの完了を遅らせ、Chromium/WebKit両方で共有待ちを再現する。
  await page.evaluate(() => {
    const original = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      const url = original(blob);
      if (blob instanceof Blob && blob.type === 'application/gzip') {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      }
      return url;
    };
  });
  const box = (await page.getByLabel('編み図編集盤面').boundingBox())!;
  await page.mouse.click(box.x + 75, box.y + 75);
  await expect(page.getByRole('button', { name: '元に戻す', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'この編み図', exact: true }).click();
  await download;
  await expect(page.locator('#app-drawer')).toContainText('この編み図はまだバックアップしていません。');
});

test('updates the busy indicator and handles events during a twenty-chart backup', async ({ page }) => {
  test.setTimeout(90_000);
  await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('documents', 'readwrite');
    const cells = new Uint32Array(1_000_000);
    cells.fill(1); // 旧形式の表目。既存バックアップとの互換も検証する。
    for (let i = 0; i < 20; i++) transaction.objectStore('documents').put({
      id: `large-${i}`, name: `大きな編み図${i}`, rows: 1000, cols: 1000,
      cells: cells.buffer, createdAt: Date.now(), updatedAt: Date.now(),
    });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error); });
    db.close();
  });
  await page.evaluate(() => {
    const state = { ticks: 0, busyTicks: 0 };
    Object.assign(window, { backupTicks: state });
    setInterval(() => { state.ticks++; if (document.querySelector('.busy')) state.busyTicks++; }, 10);
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '全データ', exact: true }).click();
  await expect(page.locator('.busy')).toHaveText('バックアップを処理中');
  const file = await download;
  expect(await page.evaluate(() => (window as unknown as { backupTicks: { busyTicks: number } }).backupTicks.busyTicks)).toBeGreaterThan(5);
  await page.locator('input[type=file]').setInputFiles((await file.path())!);
  await expect(page.locator('.busy')).toHaveText('バックアップを処理中');
  await expect(page.getByText('21件の編み図を復元しました', { exact: true })).toBeVisible({ timeout: 60_000 });
});
