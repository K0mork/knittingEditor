import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resizeBoard, storedBoards } from './board-helpers';
import { downloadInsteadOfShare, expect, test, type Page } from './fixtures';

/**
 * #157の修正前の段・列の削除で保存され得た、記号の起点が重なった編み図を固定する。
 * cellsは行優先のUint32Array。上位8bitが記号ID、下位24bitがRGB。アプリのpackCellは使わない。
 * 行優先で先に走査した起点を残し、重なる記号を記号単位で除くのが期待する修復。
 */
const CROSS = 0x07336699; // ID 7 右上交差、横2マス、青 #336699。
const KNIT = 0x01d33c32; // ID 1 表目、赤 #d33c32。
const PURL = 0x02000000; // ID 2 裏目、黒。
const overlapping = {
  id: 'stored-overlap', name: '記号が重なった模様', rows: 3, cols: 4,
  // (0,0)の右上交差が(0,1)の表目と重なる。(2,3)の裏目は重ならない。
  cells: [CROSS, KNIT, 0, 0, 0, 0, 0, 0, 0, 0, 0, PURL],
  createdAt: 1_760_000_000_000, updatedAt: 1_760_000_050_000,
};
const repairedCells = [CROSS, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, PURL];
/** 重なった盤面から作られ得たブロック。(0,0)の右上交差が(0,1)の表目と重なる。 */
const overlappingBlock = {
  id: 'stored-overlap-block', name: '重なったブロック', rows: 1, cols: 2,
  anchors: [{ row: 0, col: 0, value: CROSS }, { row: 0, col: 1, value: KNIT }],
  createdAt: 1_760_000_030_000,
};
const intact = {
  id: 'stored-intact', name: '正常な模様', rows: 2, cols: 3,
  cells: [KNIT, CROSS, 0, PURL, 0, KNIT],
  createdAt: 1_760_000_010_000, updatedAt: 1_760_000_020_000,
};

/** アプリを含まない同一originで、保存済みの編み図とブロックを持つDBを作る。`activeDocumentId`の編み図を開く。 */
async function seedStoredCharts(page: Page, activeDocumentId: string) {
  const response = await page.goto('/robots.txt');
  expect(response?.headers()['content-type']).toContain('text/plain');
  await page.evaluate(async ({ documents, blocks, activeDocumentId }) => {
    const request = indexedDB.open('knitting-editor-v2', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('documents', { keyPath: 'id' }).createIndex('updatedAt', 'updatedAt');
      db.createObjectStore('blocks', { keyPath: 'id' }).createIndex('createdAt', 'createdAt');
      db.createObjectStore('settings', { keyPath: 'key' });
    };
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const transaction = db.transaction(['documents', 'blocks', 'settings'], 'readwrite');
      for (const document of documents) {
        transaction.objectStore('documents').add({ ...document, cells: new Uint32Array(document.cells).buffer });
      }
      for (const block of blocks) transaction.objectStore('blocks').add(block);
      transaction.objectStore('settings').add({ key: 'activeDocumentId', value: activeDocumentId });
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }, { documents: [overlapping, intact], blocks: [overlappingBlock], activeDocumentId });
}

/** アプリの読み出し処理を通さず、名前ごとの保存済みセル配列を読む。 */
async function storedCells(page: Page): Promise<Record<string, number[]>> {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const get = db.transaction('documents').objectStore('documents').getAll();
      const documents = await new Promise<Array<{ name: string; cells: ArrayBuffer }>>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      return Object.fromEntries(documents.map(({ name, cells }) => [name, Array.from(new Uint32Array(cells))]));
    } finally { db.close(); }
  });
}

/** アプリの読み出し処理を通さず、名前ごとの保存済みブロックの記号を読む。 */
async function storedBlockAnchors(page: Page): Promise<Record<string, Array<{ row: number; col: number; value: number }>>> {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const get = db.transaction('blocks').objectStore('blocks').getAll();
      const blocks = await new Promise<Array<{ name: string; anchors: Array<{ row: number; col: number; value: number }> }>>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      return Object.fromEntries(blocks.map(({ name, anchors }) => [name, anchors]));
    } finally { db.close(); }
  });
}

test.beforeEach(async ({ page }) => {
  await downloadInsteadOfShare(page);
});

test('記号が重なった保存済みの編み図を開き、先の記号を残し、編集するまで原本を書き換えない', async ({ page }) => {
  await seedStoredCharts(page, overlapping.id);
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toHaveAttribute('aria-label', /3段、4目。記号2個。/);
  // 自動保存の遅延を越えて待ち、開いただけで原本を上書きしないことを確かめる。
  await page.waitForTimeout(1000);
  expect(await storedCells(page)).toEqual({ [overlapping.name]: overlapping.cells, [intact.name]: intact.cells });
});

test('記号が重なった編み図を含む全データバックアップを書き出し、すべての編み図を復元する', async ({ page }) => {
  // 書き出しは開いている編み図を先に保存するので、重なった編み図は開かずに原本のまま書き出す。
  await seedStoredCharts(page, intact.id);
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', /2段、3目。記号4個。/);
  await page.getByRole('button', { name: '出力', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '全データを書き出す', exact: true }).click();
  const path = (await (await pending).path())!;
  // 書き出しは保存されたままの盤面を入れ、修復は読み込む側で行う。
  const payload = JSON.parse(gunzipSync(await readFile(path)).toString());
  const exported = payload.documents.find((item: { name: string }) => item.name === overlapping.name);
  expect(Array.from(new Uint32Array(Uint8Array.from(Buffer.from(exported.cells, 'base64')).buffer))).toEqual(overlapping.cells);

  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByText('2件の編み図を復元しました', { exact: true })).toBeVisible();
  await expect.poll(() => storedCells(page)).toEqual({
    [overlapping.name]: overlapping.cells,
    [intact.name]: intact.cells,
    [`${overlapping.name}（復元）`]: repairedCells,
    [`${intact.name}（復元）`]: intact.cells,
  });
  // ブロックも先の記号を残して復元し、保存済みの原本は変えない。
  expect(await storedBlockAnchors(page)).toEqual({
    [overlappingBlock.name]: overlappingBlock.anchors,
    [`${overlappingBlock.name}（復元）`]: [{ row: 0, col: 0, value: CROSS }],
  });
});

test('記号が重なった保存済みのブロックを貼り付けると、先の記号を残す', async ({ page }) => {
  await seedStoredCharts(page, intact.id);
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toHaveAttribute('aria-label', /2段、3目。記号4個。/);
  await page.getByRole('button', { name: 'ブロック', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${overlappingBlock.name}`) }).click();
  await expect(canvas).toHaveAttribute('aria-label', /貼付モード/);
  // 盤面を大きく動かすと、左上のマスが表示領域（左上の目盛りを除く）の中央に来る。
  await canvas.evaluate(async (element) => {
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: -100_000, deltaY: -100_000 }));
    // 貼付の帯を出したあとの配置と描画が落ち着くまで2フレーム待つ。
    for (let frame = 0; frame < 2; frame++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  const box = (await canvas.boundingBox())!;
  const label = 28;
  const target = { x: box.x + label + (box.width - label) / 2, y: box.y + label + (box.height - label) / 2 };
  expect(await canvas.evaluate((element, point) => document.elementFromPoint(point.x, point.y) === element, target)).toBe(true);
  await page.mouse.click(target.x, target.y);
  // (0,0)に右上交差だけを置き、重なっていた表目は貼らない。貼付範囲の外の記号は残る。
  await expect.poll(async () => (await storedCells(page))[intact.name]).toEqual([CROSS, 0, 0, PURL, 0, KNIT]);
  await expect(canvas).toHaveAttribute('aria-label', /記号3個。/);
});

test('記号が重なった編み図を編集すると修復した盤面を保存し、再読み込みしても変わらない', async ({ page }) => {
  await seedStoredCharts(page, overlapping.id);
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toHaveAttribute('aria-label', /3段、4目。記号2個。/);
  await resizeBoard(page, 4, 4);
  // 起点の数は原本の3個から、残した右上交差と裏目の2個になる。
  await expect.poll(async () => (await storedBoards(page)).map((board) => `${board.rows}x${board.cols}:${board.stitches}`).sort())
    .toEqual(['2x3:4', '4x4:2']);
  await page.reload();
  await expect(canvas).toHaveAttribute('aria-label', /4段、4目。記号2個。/);
  await page.waitForTimeout(1000);
  expect((await storedCells(page))[intact.name]).toEqual(intact.cells);
  expect((await storedCells(page))[overlapping.name].filter((value) => value !== 0)).toEqual([CROSS, PURL]);
});
