import { expect, test, type Page } from './fixtures';

/**
 * IndexedDB導入前の旧Web版が`localStorage`の`knittingChartData`に保存していた形式（旧`js/storage.js`・`js/gridManager.js`）。
 * 行優先の`grid`で上の段が0段目。空きマスは`{ type: 'empty', color: '#ffffff' }`、
 * 横に続く記号は起点に`multi`、右隣に`isContinuation`、縦に続くすべり目は起点に`verticalSpan`、下に`isContinuationVertical`を置く。
 */
const empty = { type: 'empty', color: '#ffffff' };
const legacyChart = {
  numRows: 5,
  numCols: 6,
  grid: [
    [{ type: 'knit', color: '#123456' }, empty, empty, empty, empty, empty],
    [empty, { type: 'right_cross', color: '#336699', multi: 2 }, { type: 'empty', color: 'transparent', isContinuation: true }, empty, empty, empty],
    [empty, empty, empty, empty, { type: 'slip_stitch', color: '#008000', verticalSpan: 2 }, empty],
    [empty, empty, empty, empty, { type: 'empty', color: 'transparent', isContinuationVertical: true }, empty],
    [{ type: 'erase', color: '#ffffff' }, empty, empty, empty, empty, { type: 'purl', color: '#000000' }],
  ],
};

/**
 * 移行後に保存されるセル。アプリのpackCellは使わず、上位8bitの記号IDと下位24bitのRGBを固定値で書く。
 * 複数マスの記号は起点だけに値を置き、残りは0。
 */
const expectedCells = Object.assign(Array<number>(5 * 6).fill(0), {
  0: 0x01123456, // (0,0): ID 1 表目。
  7: 0x07336699, // (1,1): ID 7 右上交差、横2マス。
  16: 0x16008000, // (2,4): ID 22 すべり目、縦2マス。
  24: 0x19ffffff, // (4,0): ID 25 白くする。
  29: 0x02000000, // (4,5): ID 2 裏目。最終段・最終列。
});

/** アプリの読み出し処理を通さず、端末内の編み図と移行済みの印を読む。 */
async function storedState(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = db.transaction(['documents', 'settings']);
      const read = <T>(get: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      const documents = await read(transaction.objectStore('documents').getAll() as IDBRequest<Array<{ id: string; name: string; rows: number; cols: number; cells: ArrayBuffer }>>);
      const migrated = await read(transaction.objectStore('settings').get('legacyMigrationComplete') as IDBRequest<{ value: unknown } | undefined>);
      return {
        documents: documents.map(({ id, name, rows, cols, cells }) => ({ id, name, rows, cols, cells: [...new Uint32Array(cells)] })),
        migrated: migrated?.value,
      };
    } finally { db.close(); }
  });
}

test('migrates the legacy localStorage chart on start and does not migrate it again after a reload', async ({ page }) => {
  // アプリを含まない同一originのページで、アプリより先に旧データだけを置く。
  // addInitScriptは読み込み直すたびに走り、移行済みのあとも旧データを置き直したかどうかを区別できないので使わない。
  const response = await page.goto('/robots.txt');
  expect(response?.ok()).toBe(true);
  expect(response?.headers()['content-type']).toContain('text/plain');
  expect(await page.locator('script').count()).toBe(0);
  await page.evaluate((chart) => localStorage.setItem('knittingChartData', JSON.stringify(chart)), legacyChart);

  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toHaveAttribute('aria-label', /5段、6目。記号5個。/);
  await expect(page.locator('.app-document-name')).toContainText('移行した編み図');
  const migrated = await storedState(page);
  expect(migrated.migrated).toBe(true);
  expect(migrated.documents).toEqual([{ id: expect.any(String), name: '移行した編み図', rows: 5, cols: 6, cells: expectedCells }]);

  // 旧データは消さずに残す。再読み込みしても移行済みの印で止まり、2件目を作らない。
  await page.reload();
  await expect(canvas).toHaveAttribute('aria-label', /5段、6目。記号5個。/);
  await expect(page.locator('.app-document-name')).toContainText('移行した編み図');
  expect(await page.evaluate(() => localStorage.getItem('knittingChartData'))).toBe(JSON.stringify(legacyChart));
  expect(await storedState(page)).toEqual(migrated);
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await expect(page.locator('.document')).toHaveCount(1);
});
