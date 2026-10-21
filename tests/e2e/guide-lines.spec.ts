import { resizeBoardFromInitialView } from './board-helpers';
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

for (const input of ['tap', 'drag'] as const) {
  test(`線を${input}で引き、保存・再読み込み・消去・履歴に反映する`, async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto('/');
    const canvas = page.getByLabel('編み図編集盤面');
    await expect(canvas).toBeVisible();
    // 線の端とPNGの画素を、再読み込みの前後で同じ座標で比べるため、20×20の初期表示から始める。
    await resizeBoardFromInitialView(page, 20, 20);
    await page.getByRole('button', { name: '線', exact: true }).click();
    const box = (await canvas.boundingBox())!;
    const start = { x: box.x + 81, y: box.y + 81 };
    const end = { x: start.x, y: start.y + 120 };
    if (input === 'tap') {
      await page.mouse.click(start.x, start.y);
      await page.mouse.click(end.x, end.y);
    } else {
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(end.x + 60, end.y, { steps: 8 });
      await page.mouse.up();
    }
    await expect.poll(() => savedLines(page)).toHaveLength(1);
    const lines = await savedLines(page);
    expect(lines[0].bottom - lines[0].top).toBe(4);
    await page.getByRole('button', { name: '出力', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGを保存', exact: true }).click();
    const png = await download;
    const bytes: number[] = [];
    for await (const chunk of (await png.createReadStream())!) bytes.push(...chunk);
    const pixel = await page.evaluate(async ({ bytes, line }) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      // 矢印の三角の中央はアンチエイリアスの境界を避けて線の色そのものを読める。
      return Array.from(context.getImageData(24 + (line.col + 0.5) * 24, 24 + line.bottom * 24 - 3, 1, 1).data);
    }, { bytes, line: lines[0] });
    expect(pixel).toEqual([51, 51, 51, 255]);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.getByRole('button', { name: '元に戻す', exact: true }).click();
    await expect.poll(() => savedLines(page)).toEqual([]);
    await page.getByRole('button', { name: 'やり直す', exact: true }).click();
    await expect.poll(() => savedLines(page)).toEqual(lines);
    await page.reload();
    await expect(canvas).toBeVisible();
    await expect.poll(() => savedLines(page)).toEqual(lines);
    await page.getByRole('button', { name: '線', exact: true }).click();
    const reloaded = (await canvas.boundingBox())!;
    await page.mouse.click(reloaded.x + 81, reloaded.y + 141);
    await expect.poll(() => savedLines(page)).toEqual([]);
    await page.getByRole('button', { name: '元に戻す', exact: true }).click();
    await expect.poll(() => savedLines(page)).toEqual(lines);
    await page.getByRole('button', { name: '消す', exact: true }).click();
    await page.mouse.move(reloaded.x + 51, reloaded.y + 141);
    await page.mouse.down();
    await page.mouse.move(reloaded.x + 111, reloaded.y + 141, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => savedLines(page)).toEqual([]);
    await page.getByRole('button', { name: '元に戻す', exact: true }).click();
    await expect.poll(() => savedLines(page)).toEqual(lines);
    await page.getByRole('button', { name: 'やり直す', exact: true }).click();
    await expect.poll(() => savedLines(page)).toEqual([]);
  });
}

test('タッチでは1本指のタップ2回で線を引き、間のマスのタップで消す', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'タッチ端末の操作');
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  await page.getByRole('button', { name: '線', exact: true }).click();
  const box = (await canvas.boundingBox())!;
  const cell = { x: box.x + 81, y: box.y + 81 };
  await page.touchscreen.tap(cell.x, cell.y);
  await page.touchscreen.tap(cell.x, cell.y + 120);
  await expect.poll(() => savedLines(page)).toHaveLength(1);
  const [line] = await savedLines(page);
  expect(line.bottom - line.top).toBe(4);
  await page.touchscreen.tap(cell.x, cell.y + 60);
  await expect.poll(() => savedLines(page)).toEqual([]);
});

for (const width of [320, 375, 390, 429, 430, 1200]) {
  test(`${width}px幅で線ボタンが収まり、375px以上では表目が省略されない`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/');
    await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
    const toolbar = page.getByRole('region', { name: '編集ツール' });
    const baseline = await toolbar.locator('.stitch-tool').evaluate((button) => ({
      height: button.getBoundingClientRect().height, fontSize: getComputedStyle(button).fontSize,
    }));
    await page.setViewportSize({ width, height: 900 });
    const line = toolbar.getByRole('button', { name: '線', exact: true });
    await expect(line).toBeVisible();
    const sizes = await toolbar.evaluate((element) => {
      const label = element.querySelector<HTMLElement>('.stitch-tool-name')!;
      const button = element.querySelector<HTMLButtonElement>('.stitch-tool')!;
      return {
        width: element.clientWidth, scrollWidth: element.scrollWidth,
        labelWidth: label.clientWidth, labelScrollWidth: label.scrollWidth,
        height: button.getBoundingClientRect().height,
        fontSize: getComputedStyle(button).fontSize,
        padding: getComputedStyle(button).paddingInlineStart,
        gap: getComputedStyle(element).gap,
      };
    });
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width);
    expect(sizes.height).toBe(baseline.height);
    expect(sizes.fontSize).toBe(baseline.fontSize);
    if (width >= 375) {
      await expect(toolbar.locator('.stitch-tool-name')).toHaveText('表目');
      expect(sizes.labelScrollWidth).toBeLessThanOrEqual(sizes.labelWidth);
    }
    if (width <= 429) {
      expect(sizes.padding).toBe('4px');
      expect(sizes.gap).toBe('3px');
    } else {
      expect(sizes.padding).toBe('8px');
      expect(sizes.gap).toBe(width < 760 ? '5px' : '7px');
    }
    // 貼付ボタンが並んで窮屈になるのは狭い画面だけ。広い画面では盤面が中央に寄り、下の座標が盤面の外になる。
    if (width >= 375 && width < 760) {
      await page.getByRole('button', { name: '編み目記号を選ぶ', exact: true }).click();
      await page.getByRole('dialog', { name: '編み目記号' }).getByRole('button', { name: /^右上2目交差/ }).click();
      const canvas = page.getByLabel('編み図編集盤面');
      const box = (await canvas.boundingBox())!;
      await toolbar.getByRole('button', { name: '範囲', exact: true }).click();
      await page.mouse.move(box.x + 81, box.y + 81);
      await page.mouse.down();
      await page.mouse.move(box.x + 111, box.y + 111);
      await page.mouse.up();
      await page.getByRole('button', { name: 'コピーして貼付', exact: true }).click();
      await expect(toolbar.getByRole('button', { name: '貼付', exact: true })).toBeVisible();
      expect(await toolbar.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
  });
}
