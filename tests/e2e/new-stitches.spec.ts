import { expect, test } from './fixtures';

for (const [name, id] of [['右増し目', 27], ['左増し目', 28], ['浮き目', 29]] as const) {
  test(`selects and persists ${name} from 編み目記号`, async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
    await page.getByRole('button', { name: '編み目記号を選ぶ' }).click();
    const picker = page.getByRole('dialog', { name: '編み目記号' });
    const option = picker.getByRole('button', { name: new RegExp(`^${name}`) });
    await expect(option.locator('svg')).toBeVisible();
    await option.click();
    await expect(picker).not.toBeVisible();
    await expect(page.locator('.stitch-tool-name')).toHaveText(name);
    const canvas = page.getByLabel('編み図編集盤面');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + 28 + (box!.width - 28) / 2, box!.y + 28 + (box!.height - 28) / 2);
    const storedIds = () => page.evaluate(async () => {
      const request = indexedDB.open('knitting-editor-v2');
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const get = db.transaction('documents').objectStore('documents').getAll();
        const documents = await new Promise<Array<{ cells: ArrayBuffer }>>((resolve, reject) => {
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => reject(get.error);
        });
        return documents.flatMap((document) => [...new Uint32Array(document.cells)].filter(Boolean).map((value) => value >>> 24));
      } finally { db.close(); }
    });
    await expect.poll(storedIds).toEqual([id]);
    await page.reload();
    await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
    await expect.poll(storedIds).toEqual([id]);
  });
}
