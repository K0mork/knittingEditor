import { downloadInsteadOfShare, expect, test } from './fixtures';

const workerPattern = /\/assets\/(pdf|backup)\.worker-[^/]+\.js(?:\?.*)?$/;
test.beforeEach(async ({ page }) => {
  await downloadInsteadOfShare(page);
});

test('keeps PDF and backup export/restore working after worker assets disappear', async ({ page }) => {
  // fetchの完了（応答本文の保持まで）を待ってから配信物を取り除く。
  await page.addInitScript(() => {
    const original = window.fetch;
    const state = { completed: 0 };
    Object.assign(window, { workerPrefetches: state });
    window.fetch = async (...args) => {
      const response = await original(...args);
      if (/\/assets\/(pdf|backup)\.worker-/.test(String(args[0])) && !args[1]?.method) {
        const text = response.text.bind(response);
        response.text = async () => {
          const body = await text();
          state.completed++;
          return body;
        };
      }
      return response;
    };
  });
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { workerPrefetches: { completed: number } }).workerPrefetches.completed === 2);
  await page.route(workerPattern, (route) => route.fulfill({ status: 404, body: '' }));
  await page.getByRole('button', { name: '出力', exact: true }).click();
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDFを保存', exact: true }).click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: 'この編み図を書き出す', exact: true }).click();
  const file = await backup;
  expect(file.suggestedFilename()).toMatch(/\.knit$/);
  await page.locator('input[type=file]').setInputFiles((await file.path())!);
  await expect(page.getByText('1件の編み図を復元しました', { exact: true })).toBeVisible();
});

for (const saveFailed of [false, true]) {
  test(`explains unavailable workers safely when saveFailed=${saveFailed}`, async ({ page }) => {
    await page.route(workerPattern, (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/');
    const canvas = page.getByLabel('編み図編集盤面');
    await expect(canvas).toBeVisible();
    if (saveFailed) {
      await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function (value, key) {
          if (this.name === 'documents') throw new DOMException('full', 'QuotaExceededError');
          return original.call(this, value, key);
        };
      });
      const box = (await canvas.boundingBox())!;
      await page.mouse.click(box.x + 75, box.y + 75);
      await expect(page.locator('.app-header')).toContainText('保存失敗');
    }
    await page.getByRole('button', { name: '出力', exact: true }).click();
    await page.getByRole('button', { name: 'PDFを保存', exact: true }).click();
    const toast = page.locator('.toast');
    await expect(toast).toContainText('サイトが更新されました');
    if (saveFailed) {
      await expect(toast).toContainText('PNG');
      await expect(toast).toContainText('未保存の編集が失われます');
      await expect(toast.getByRole('button', { name: '再読み込み', exact: true })).toHaveCount(0);
    } else await expect(toast.getByRole('button', { name: '再読み込み', exact: true })).toBeVisible();
  });
}
