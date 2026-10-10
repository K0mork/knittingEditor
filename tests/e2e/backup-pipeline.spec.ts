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
  const notice = page.getByRole('region', { name: '保存の失敗' });
  await page.mouse.click(box.x + 75, box.y + 75);
  // 失敗はすぐ見出しに出すが、帯は手を止めるまで出さず、続けて描いても盤面をずらさない。
  await expect(page.locator('.app-header')).toContainText('保存失敗');
  await page.mouse.click(box.x + 75, box.y + 115);
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
  await expect(notice).toHaveCount(0);
  expect((await canvas.boundingBox())!.y).toBe(box.y);
  await expect(notice.getByRole('alert')).toHaveText('端末内への保存に失敗しています。「保存」から.knitのバックアップを書き出してください。', { timeout: 10_000 });
  await page.waitForTimeout(5_000);
  await expect(notice).toBeVisible();
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
    const state = { ticks: 0, busyTicks: 0, maxGap: 0, last: performance.now() };
    Object.assign(window, { backupTicks: state });
    setInterval(() => {
      const now = performance.now();
      if (document.querySelector('.busy')) {
        state.busyTicks++;
        state.maxGap = Math.max(state.maxGap, now - state.last);
      }
      state.last = now;
      state.ticks++;
    }, 10);
  });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '全データ', exact: true }).click();
  await expect(page.locator('.busy')).toHaveText('バックアップを処理中');
  const file = await download;
  const ticks = await page.evaluate(() => (window as unknown as { backupTicks: { busyTicks: number; maxGap: number } }).backupTicks);
  expect(ticks.busyTicks).toBeGreaterThan(5);
  // 変更前は圧縮の間ずっと止まり、最大間隔が2秒を超えていた。
  expect(ticks.maxGap).toBeLessThan(1_000);
  await page.locator('input[type=file]').setInputFiles((await file.path())!);
  await expect(page.locator('.busy')).toHaveText('バックアップを処理中');
  await expect(page.getByText('21件の編み図を復元しました', { exact: true })).toBeVisible({ timeout: 60_000 });
});

test('keeps the shared generation unrecorded when undo runs while the iPhone share dialog is open', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'webkit-mobile', 'iPhone Safariだけの保存導線');
  await page.addInitScript(() => {
    const state = { shared: [] as string[] };
    Object.assign(window, { shareState: state });
    Object.defineProperty(navigator, 'canShare', { value: (data: ShareData) => (data.files?.length ?? 0) > 0, configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => { state.shared.push(...(data.files ?? []).map((file) => file.name)); },
    });
  });
  await page.reload();
  const canvas = page.getByLabel('編み図編集盤面');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + 75, box.y + 75);
  await expect(canvas).toHaveAttribute('aria-label', /記号1個/);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.locator('#app-drawer').getByRole('button', { name: 'この編み図' }).click();
  const dialog = page.getByRole('dialog', { name: '「新しい編み図.knit」の準備ができました' });
  await expect(dialog).toBeVisible();
  // 確認ダイアログを開いたまま元に戻すと、渡すファイルは今の盤面のバックアップではなくなる。
  await page.keyboard.press('Meta+z');
  await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
  await dialog.getByRole('button', { name: '共有・保存' }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { shareState: { shared: string[] } }).shareState.shared)).toEqual(['新しい編み図.knit']);
  await expect(page.locator('#app-drawer')).toContainText('この編み図はまだバックアップしていません。');
});
