import { expect, test, type Page } from './fixtures';

const DAY = 24 * 60 * 60 * 1000;

test.beforeEach(async ({ page }) => {
  // iPhone相当の設定では共有シートへ渡す。ここではダウンロードで書き出しを確かめる。
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

/** 端末内の編み図を「`ageDays`日前に作り、そのあと変更した」（`changed`が`false`なら作ったまま）状態にする。 */
async function ageChart(page: Page, ageDays: number, changed = true) {
  await page.evaluate(async ([age, edited]) => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const store = db.transaction('documents', 'readwrite').objectStore('documents');
    const get = store.getAll();
    const [document] = await new Promise<Array<{ createdAt: number; updatedAt: number }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    const createdAt = Date.now() - age;
    store.put({ ...document, createdAt, updatedAt: edited ? Date.now() : createdAt });
    await new Promise((resolve) => { store.transaction.oncomplete = resolve; });
    db.close();
  }, [ageDays * DAY, changed] as const);
}

/**
 * 記録を読み終えても帯が出ていないことを確かめる。
 * 保存パネルに日時が出れば日時と「あとで」の記録を読み終えている。帯を出すかはその時点で決まるので、
 * パネルを閉じた同じ描画で帯が無ければ、待ち時間に頼らずに「出ない」と言える。
 */
async function expectNoReminderOnceLoaded(page: Page) {
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const drawer = page.locator('#app-drawer');
  await expect(drawer).toContainText(/この編み図(の最後のバックアップ：|はまだバックアップしていません。)/);
  await drawer.getByRole('button', { name: '閉じる' }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole('region', { name: 'バックアップのおすすめ' })).toHaveCount(0);
}

async function chartId(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const get = db.transaction('documents').objectStore('documents').getAll();
    const [document] = await new Promise<Array<{ id: string }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    db.close();
    return document.id;
  });
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
  await expectNoReminderOnceLoaded(page);

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
  await expectNoReminderOnceLoaded(page);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#app-drawer')).toContainText('この編み図の最後のバックアップ：');
});

test('keeps the board in place while a stroke is held down and suggests the backup after release', async ({ page }) => {
  // 8日前に作ったまま変更していない編み図は、開いた時点では勧めない。1回編集すると勧める対象になる。
  await ageChart(page, 8, false);
  await page.reload();
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  await expectNoReminderOnceLoaded(page);
  const reminder = page.getByRole('region', { name: 'バックアップのおすすめ' });

  // 帯が最初に出た時刻と、最後に指を離した時刻を記録する。
  await page.evaluate(() => {
    const log = { appearedAt: 0, releasedAt: 0 };
    Object.assign(window, { reminderLog: log });
    new MutationObserver(() => {
      if (!log.appearedAt && document.querySelector('.backup-reminder')) log.appearedAt = performance.now();
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pointerup', () => { log.releasedAt = performance.now(); }, true);
  });

  // 1回タップし、すぐ次のなぞり描きを始めて、待ち時間より長く指を置いたままにする。
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + 75, box.y + 75);
  await page.mouse.move(box.x + 75, box.y + 105);
  await page.mouse.down();
  await page.mouse.move(box.x + 105, box.y + 105, { steps: 3 });
  await page.waitForTimeout(3_500);
  await page.mouse.move(box.x + 135, box.y + 105, { steps: 3 });
  expect((await canvas.boundingBox())!.y).toBe(box.y);
  await page.mouse.up();

  // 離してから待ち時間がたつと出る。出たのは指を離した後で、指を置いている間ではない。
  await expect(reminder).toBeVisible();
  const log = await page.evaluate(() => (window as unknown as { reminderLog: { appearedAt: number; releasedAt: number } }).reminderLog);
  expect(log.appearedAt).toBeGreaterThan(log.releasedAt);
  expect((await canvas.boundingBox())!.y).toBeGreaterThan(box.y);
});

test('records the backup only after the file is shared on iPhone Safari', async ({ page }, testInfo) => {
  // iPhone・iPadのSafariは確認ダイアログから共有シートで渡す。閉じる・取り消しでは書き出したことにしない。
  test.skip(testInfo.project.name !== 'webkit-mobile', 'iPhone Safariだけの保存導線');
  await page.addInitScript(() => {
    const state = { shared: [] as string[], cancelNext: false };
    Object.assign(window, { shareState: state });
    Object.defineProperty(navigator, 'canShare', { value: (data: ShareData) => (data.files?.length ?? 0) > 0, configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        if (state.cancelNext) {
          state.cancelNext = false;
          throw new DOMException('cancelled', 'AbortError');
        }
        state.shared.push(...(data.files ?? []).map((file) => file.name));
      },
    });
  });
  await ageChart(page, 8);
  await page.reload();
  const reminder = page.getByRole('region', { name: 'バックアップのおすすめ' });
  await expect(reminder).toBeVisible();
  const dialog = page.getByRole('dialog', { name: '「新しい編み図.knit」の準備ができました' });
  const shared = () => page.evaluate(() => (window as unknown as { shareState: { shared: string[] } }).shareState.shared);

  // 確認ダイアログを閉じると、帯は残り、日時も記録しない。
  await reminder.getByRole('button', { name: '書き出す' }).click();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(dialog).toBeHidden();
  await expect(reminder).toBeVisible();

  // 共有シートを取り消したときも同じ。
  await page.evaluate(() => { (window as unknown as { shareState: { cancelNext: boolean } }).shareState.cancelNext = true; });
  await reminder.getByRole('button', { name: '書き出す' }).click();
  await dialog.getByRole('button', { name: '共有・保存' }).click();
  await expect(dialog).toBeHidden();
  await expect(reminder).toBeVisible();
  expect(await shared()).toEqual([]);
  expect(await readSetting(page, `lastBackupAt:${await chartId(page)}`)).toBeUndefined();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('#app-drawer')).toContainText('この編み図はまだバックアップしていません。');

  // 共有を終えたら記録し、帯を消す。
  await page.locator('#app-drawer').getByRole('button', { name: 'この編み図' }).click();
  await dialog.getByRole('button', { name: '共有・保存' }).click();
  await expect(dialog).toBeHidden();
  expect(await shared()).toEqual(['新しい編み図.knit']);
  await expect(page.locator('#app-drawer')).toContainText('この編み図の最後のバックアップ：');
});
