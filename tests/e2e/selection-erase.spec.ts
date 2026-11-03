import { expectAutosaved, resizeBoardFromInitialView, storedBoards } from './board-helpers';
import { expect, test, type Page } from './fixtures';

async function savedLines(page: Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const get = db.transaction('documents').objectStore('documents').getAll();
      const documents = await new Promise<Array<{ guideLines?: Array<{ col: number; top: number; bottom: number }> }>>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      return documents.flatMap((document) => document.guideLines ?? []);
    } finally { db.close(); }
  });
}

/** 盤面の左上からの座標で範囲を囲む。 */
async function selectArea(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.getByLabel('編み図編集盤面').boundingBox())!;
  await page.getByRole('button', { name: '範囲', exact: true }).click();
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('toolbar', { name: '選択範囲の操作' })).toBeVisible();
}

test('erases the stitches and lines in a selection as one undoable step and keeps the result after reload', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  // 同じ座標で記号と範囲を合わせるため、20×20の初期表示から始める。
  await resizeBoardFromInitialView(page, 20, 20);
  const box = (await canvas.boundingBox())!;
  for (const [x, y] of [[81, 81], [141, 81], [81, 231], [261, 261]]) await page.mouse.click(box.x + x, box.y + y);
  await expect(canvas).toHaveAttribute('aria-label', /記号4個/);
  await page.getByRole('button', { name: '線', exact: true }).click();
  await page.mouse.click(box.x + 111, box.y + 81);
  await page.mouse.click(box.x + 111, box.y + 231);
  await expect.poll(() => savedLines(page)).toHaveLength(1);
  const lines = await savedLines(page);

  // 上の2目と、範囲をまたぐ線を囲む。下の2目は範囲の外。
  await selectArea(page, [70, 70], [150, 150]);
  await page.getByRole('toolbar', { name: '選択範囲の操作' }).getByRole('button', { name: '選択範囲を消去', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
  await expect.poll(() => savedLines(page)).toEqual([]);
  await expect(page.getByRole('toolbar', { name: '選択範囲の操作' })).toHaveCount(0);
  // 道具は範囲選択のまま、選択だけが外れる。
  await expect(page.getByRole('button', { name: '範囲', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', /範囲選択モード。選択範囲なし/);
  const toast = page.locator('.toast');
  await expect(toast).toContainText('選択範囲を消去しました');

  await expect(toast.getByRole('button')).toHaveCount(0);

  // 「元に戻す」1回で、記号と線がそろって戻る。
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-label', /記号4個/);
  await expect.poll(() => savedLines(page)).toEqual(lines);
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
  await expect.poll(() => savedLines(page)).toEqual([]);

  await expect.poll(async () => (await storedBoards(page)).map((board) => board.stitches)).toEqual([2]);
  await expectAutosaved(page);
  await page.reload();
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
  expect(await savedLines(page)).toEqual([]);
});

test('erases a selection with Delete or Backspace except while typing', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  await resizeBoardFromInitialView(page, 20, 20);
  const box = (await canvas.boundingBox())!;
  for (const [x, y] of [[81, 81], [261, 261]]) await page.mouse.click(box.x + x, box.y + y);
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
  const toolbar = page.getByRole('toolbar', { name: '選択範囲の操作' });

  // 入力欄の中のBackspaceは文字を消すだけで、盤面は消さない。
  await selectArea(page, [70, 70], [100, 100]);
  await page.getByRole('button', { name: '盤面', exact: true }).click();
  await page.getByLabel('段数', { exact: true }).press('Backspace');
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
  await expect(toolbar).toBeVisible();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();

  await page.keyboard.press('Delete');
  await expect(canvas).toHaveAttribute('aria-label', /記号1個。範囲選択モード。選択範囲なし/);
  await expect(toolbar).toHaveCount(0);

  // 消すものが無い範囲では、選択を残して伝える。
  await selectArea(page, [70, 70], [100, 100]);
  await page.keyboard.press('Backspace');
  await expect(page.locator('.toast')).toContainText('選択範囲に消すものがありません');
  await expect(toolbar).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', /記号1個/);

  await selectArea(page, [250, 250], [270, 270]);
  await page.keyboard.press('Backspace');
  await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
});
