import { Board } from '../../packages/editor-core/model/Board';
import { expect, test, type Page } from './fixtures';

async function storedBoard(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const get = db.transaction('documents').objectStore('documents').getAll();
      const documents = await new Promise<Array<{ rows: number; cols: number; cells: ArrayBuffer }>>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      const { rows, cols, cells } = documents[0];
      return { rows, cols, cells: [...new Uint32Array(cells)] };
    } finally { db.close(); }
  });
}

async function seedBoard(page: Page, board: Board) {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.evaluate(async ({ rows, cols, cells }) => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = db.transaction('documents', 'readwrite');
      const done = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      const store = transaction.objectStore('documents');
      const get = store.getAll();
      get.onsuccess = () => store.put({ ...get.result[0], rows, cols, cells: new Uint32Array(cells).buffer });
      await done;
    } finally { db.close(); }
  }, { rows: board.rows, cols: board.cols, cells: [...board.cells] });
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', new RegExp(`記号${board.occupiedStitchCount}個`));
}

async function changeDimensions(page: Page, rows: string, cols: string) {
  await page.getByLabel('段数', { exact: true }).fill(rows);
  await page.getByLabel('列数', { exact: true }).fill(cols);
  await page.getByRole('button', { name: '変更', exact: true }).click();
}

for (const width of [390, 1280]) {
  test(`keeps stitch numbers when resizing columns at the left edge (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const board = new Board();
    board.place(19, 17, 'knit', '#123456');
    await seedBoard(page, board);
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });
    await page.getByRole('button', { name: '盤面', exact: true }).click();
    for (const cols of [22, 18, 20]) {
      await changeDimensions(page, '20', String(cols));
      board.resize(20, cols, 0, cols - board.cols);
      await expect.poll(() => storedBoard(page)).toEqual({ rows: 20, cols, cells: [...board.cells] });
      expect(board.valueAt(19, cols - 3)).not.toBe(0);
    }
    expect(dialogs).toEqual([]);
  });

  test(`confirms lost stitches, cancels safely and undoes with the grid panel open (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const board = new Board();
    board.place(0, 10, 'knit', '#123456');
    board.place(10, 1, 'right_up_two_cross', '#123456');
    board.place(10, 10, 'knit', '#123456');
    await seedBoard(page, board);
    const original = { rows: 20, cols: 20, cells: [...board.cells] };
    const canvas = page.getByLabel('編み図編集盤面');
    await page.getByRole('button', { name: '盤面', exact: true }).click();
    const drawer = page.locator('.drawer');
    const bottomHistory = page.locator('.action-bar .history-tools');
    await expect(bottomHistory).toBeHidden();
    const undo = drawer.getByRole('button', { name: '元に戻す', exact: true });
    const redo = drawer.getByRole('button', { name: 'やり直す', exact: true });
    await expect(undo).toBeDisabled();
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('記号2個が消えます。変更しますか？');
      await dialog.dismiss();
    });
    await changeDimensions(page, '18', '18');
    await expect(canvas).toHaveAttribute('aria-label', /20段、20目.*記号3個/);
    await expect(undo).toBeDisabled();
    expect(await storedBoard(page)).toEqual(original);
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('記号2個が消えます。変更しますか？');
      await dialog.accept();
    });
    await page.getByRole('button', { name: '変更', exact: true }).click();
    await expect(canvas).toHaveAttribute('aria-label', /18段、18目.*記号1個/);
    board.resize(18, 18, -2, -2);
    const resized = { rows: 18, cols: 18, cells: [...board.cells] };
    await expect.poll(() => storedBoard(page)).toEqual(resized);
    // 強制クリックせず、パネルを閉じずにタッチできることを確かめる。
    await drawer.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await undo.click();
    await expect(drawer).toBeVisible();
    await expect(canvas).toHaveAttribute('aria-label', /20段、20目.*記号3個/);
    await expect(page.getByLabel('段数', { exact: true })).toHaveValue('20');
    await expect(page.getByLabel('列数', { exact: true })).toHaveValue('20');
    await expect.poll(() => storedBoard(page)).toEqual(original);
    await redo.click();
    await expect(canvas).toHaveAttribute('aria-label', /18段、18目.*記号1個/);
    await expect.poll(() => storedBoard(page)).toEqual(resized);
    await drawer.getByRole('button', { name: '閉じる', exact: true }).click();
    await expect(bottomHistory).toBeVisible();
  });
}

test('keeps immediate size input after opening the grid panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '盤面', exact: true }).click();
  const rows = page.getByLabel('段数', { exact: true });
  await rows.fill('');
  await expect(rows).toHaveValue('');
  await rows.fill('1000');
  await page.getByLabel('列数', { exact: true }).fill('250');
  await expect(rows).toHaveValue('1000');
  await page.getByRole('button', { name: '変更', exact: true }).click();
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', /1000段、250目/);
});

test('deletes occupied edges and specified positions without confirmation', async ({ page }) => {
  const cases = [
    { name: '上の段', row: 0, col: 0, rows: 3, cols: 4 },
    { name: '下の段', row: 3, col: 0, rows: 3, cols: 4 },
    { name: '左の列', row: 0, col: 0, rows: 4, cols: 3 },
    { name: '右の列', row: 0, col: 3, rows: 4, cols: 3 },
    { name: '段を削除', row: 1, col: 1, rows: 3, cols: 4 },
    { name: '列を削除', row: 1, col: 1, rows: 4, cols: 3 },
  ];
  for (const item of cases) {
    const board = new Board(4, 4);
    board.place(item.row, item.col, 'knit', '#123456');
    await seedBoard(page, board);
    await page.getByRole('button', { name: '盤面', exact: true }).click();
    const dialogs: string[] = [];
    const handleDialog = async (dialog: import('@playwright/test').Dialog) => {
      dialogs.push(dialog.type());
      if (dialog.type() === 'prompt') await dialog.accept('3');
      else await dialog.dismiss();
    };
    page.on('dialog', handleDialog);
    await page.getByRole('button', { name: item.name, exact: true }).click();
    await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', new RegExp(`${item.rows}段、${item.cols}目.*記号0個`));
    expect(dialogs).toEqual(item.name.endsWith('削除') ? ['prompt'] : []);
    await expect(page.locator('.toast')).toHaveCount(0);
    page.off('dialog', handleDialog);
  }
});
