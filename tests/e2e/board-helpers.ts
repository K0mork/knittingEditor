import { expect, type Page } from './fixtures';

/** 固定座標で操作するテストの盤面を、設定パネルから指定の大きさにそろえる。 */
export async function resizeBoard(page: Page, rows: number, cols: number) {
  await page.getByRole('button', { name: '盤面', exact: true }).click();
  await page.getByLabel('段数', { exact: true }).fill(String(rows));
  await page.getByLabel('列数', { exact: true }).fill(String(cols));
  await page.getByRole('button', { name: '変更', exact: true }).click();
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', new RegExp(`${rows}段、${cols}目`));
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
}

/**
 * 大きさを変えた盤面は変更前の表示位置を引き継ぐ。再読み込みの前後で同じ座標を押すテストは、
 * 保存を待ってから読み込み直し、指定の大きさの初期表示から始める。
 */
export async function resizeBoardFromInitialView(page: Page, rows: number, cols: number) {
  await resizeBoard(page, rows, cols);
  await expect.poll(() => page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const get = db.transaction('documents').objectStore('documents').getAll();
      const documents = await new Promise<Array<{ rows: number; cols: number }>>((resolve, reject) => {
        get.onsuccess = () => resolve(get.result);
        get.onerror = () => reject(get.error);
      });
      return documents.map((document) => `${document.rows}x${document.cols}`);
    } finally { db.close(); }
  })).toEqual([`${rows}x${cols}`]);
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', new RegExp(`${rows}段、${cols}目`));
}
