import { expect, test, type Page } from '@playwright/test';

const DAY = 24 * 60 * 60 * 1000;

test.beforeEach(async ({ page }) => {
  // iPhone相当の設定では共有シートへ渡す。ここではダウンロードで書き出しを確かめる。
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

/** 端末内の編み図を「`ageDays`日前に作り、そのあと変更した」状態にする。 */
async function ageChart(page: Page, ageDays: number) {
  await page.evaluate(async (age) => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const store = db.transaction('documents', 'readwrite').objectStore('documents');
    const get = store.getAll();
    const [document] = await new Promise<Array<{ createdAt: number; updatedAt: number }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    store.put({ ...document, createdAt: Date.now() - age, updatedAt: Date.now() });
    await new Promise((resolve) => { store.transaction.oncomplete = resolve; });
    db.close();
  }, ageDays * DAY);
}

async function readSetting(page: Page, key: string) {
  return page.evaluate(async (settingKey) => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const get = db.transaction('settings').objectStore('settings').get(settingKey);
    const record = await new Promise<{ value: unknown } | undefined>((resolve) => { get.onsuccess = () => resolve(get.result); });
    db.close();
    return record?.value as number | undefined;
  }, key);
}

async function setSetting(page: Page, key: string, value: number) {
  await page.evaluate(async ([settingKey, settingValue]) => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('settings', 'readwrite');
    transaction.objectStore('settings').put({ key: settingKey, value: settingValue });
    await new Promise((resolve) => { transaction.oncomplete = resolve; });
    db.close();
  }, [key, value] as const);
}

test('shows the last backup date after exporting and keeps it after a reload', async ({ page }) => {
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const drawer = page.locator('#app-drawer');
  await expect(drawer).toContainText('この編み図はまだバックアップしていません。');

  const download = page.waitForEvent('download');
  await drawer.getByRole('button', { name: 'この編み図' }).click();
  expect((await download).suggestedFilename()).toBe('新しい編み図.knit');
  await expect(drawer).toContainText(/この編み図の最後のバックアップ：\d{4}年\d{1,2}月\d{1,2}日 \d{1,2}:\d{2}/);

  await page.reload();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#app-drawer')).toContainText(/この編み図の最後のバックアップ：\d{4}年/);
});

test('suggests a backup for a week-old chart without covering the board', async ({ page }) => {
  const reminder = page.getByRole('region', { name: 'バックアップのおすすめ' });
  await expect(reminder).toBeHidden();
  await ageChart(page, 8);
  await page.reload();
  await expect(reminder).toContainText('この編み図はまだバックアップしていません。');

  // 盤面には重ねず、道具列と盤面の間に出す。ボタンは押しやすい大きさにする。
  const reminderBox = (await reminder.boundingBox())!;
  const toolsBox = (await page.getByRole('region', { name: '編集ツール' }).boundingBox())!;
  const canvasBox = (await page.getByLabel('編み図編集盤面').boundingBox())!;
  expect(reminderBox.y).toBeGreaterThanOrEqual(toolsBox.y + toolsBox.height - 1);
  expect(canvasBox.y).toBeGreaterThanOrEqual(reminderBox.y + reminderBox.height - 1);
  for (const name of ['書き出す', 'あとで']) {
    expect((await reminder.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(34);
  }
  const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(width).toBeLessThanOrEqual(0);

  // 「あとで」で閉じると、再読み込みしても出ない。
  await reminder.getByRole('button', { name: 'あとで' }).click();
  await expect(reminder).toBeHidden();
  // 閉じた日時は書き込みを待たずに画面から消すので、端末へ届いてから再読み込みする。
  await expect.poll(() => readSetting(page, 'backupReminderSnoozedUntil')).toBeGreaterThan(Date.now() + 2 * DAY);
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(reminder).toBeHidden();

  // 待つ期間が過ぎれば、また出る。書き出すと消え、再読み込みしても出ない。
  await setSetting(page, 'backupReminderSnoozedUntil', Date.now() - 1);
  await page.reload();
  await expect(reminder).toBeVisible();
  const download = page.waitForEvent('download');
  await reminder.getByRole('button', { name: '書き出す' }).click();
  expect((await download).suggestedFilename()).toBe('新しい編み図.knit');
  await expect(reminder).toBeHidden();
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.waitForTimeout(300);
  await expect(reminder).toBeHidden();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#app-drawer')).toContainText('この編み図の最後のバックアップ：');
});
