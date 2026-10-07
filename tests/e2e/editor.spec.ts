import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '棒針編み図エディタ' })).toBeVisible();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

test('draws continuously and restores the board after reload', async ({ page }) => {
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.move(box!.x + 180, box!.y + 75, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const storedBefore = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('documents');
    const get = transaction.objectStore('documents').getAll();
    return await new Promise<{ bytes: number; filled: number }>((resolve) => { get.onsuccess = () => {
      const cells = new Uint32Array(get.result[0].cells);
      resolve({ bytes: cells.byteLength, filled: cells.filter(Boolean).length });
    }; });
  });
  expect(storedBefore.bytes).toBe(1600);
  expect(storedBefore.filled).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByText('新しい編み図', { exact: false })).toBeVisible();
  const storedAfter = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('documents');
    const get = transaction.objectStore('documents').getAll();
    return await new Promise<number>((resolve) => { get.onsuccess = () => {
      resolve(new Uint32Array(get.result[0].cells).filter(Boolean).length);
    }; });
  });
  expect(storedAfter).toBe(storedBefore.filled);
});

test('does not draw when a second touch turns a tap into a two-finger gesture', async ({ page }) => {
  const canvas = page.getByLabel('編み図編集盤面');
  await canvas.evaluate((element) => {
    // Synthetic PointerEvents are not registered in the browser's native pointer-capture table.
    element.setPointerCapture = () => {};
    const rect = element.getBoundingClientRect();
    const dispatch = (type: string, pointerId: number, x: number, y: number) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: 'touch',
      clientX: rect.left + x,
      clientY: rect.top + y,
      button: 0,
      isPrimary: pointerId === 1,
    }));
    dispatch('pointerdown', 1, 75, 75);
    dispatch('pointerdown', 2, 135, 75);
    dispatch('pointermove', 1, 70, 75);
    dispatch('pointermove', 2, 140, 75);
    dispatch('pointerup', 2, 140, 75);
    dispatch('pointerup', 1, 70, 75);
  });
  await page.waitForTimeout(700);

  const filled = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const get = db.transaction('documents').objectStore('documents').getAll();
    const documents = await new Promise<Array<{ cells: ArrayBuffer }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    return new Uint32Array(documents[0].cells).filter(Boolean).length;
  });
  expect(filled).toBe(0);
});

test('prevents the canvas wheel gesture from reaching page zoom', async ({ page }) => {
  const prevented = await page.getByLabel('編み図編集盤面').evaluate((element) => {
    const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -20 });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
});

/** 盤面の番号の帯（`BoardCanvas.tsx`の`LABEL_SIZE`）を除いた表示領域の中央をクリックする。 */
async function clickBoardCenter(page: import('@playwright/test').Page) {
  const box = await page.getByLabel('編み図編集盤面').boundingBox();
  expect(box).not.toBeNull();
  const label = 28;
  await page.mouse.click(box!.x + label + (box!.width - label) / 2, box!.y + label + (box!.height - label) / 2);
}

async function storedCells(page: import('@playwright/test').Page) {
  await page.waitForTimeout(700);
  return await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const get = db.transaction('documents').objectStore('documents').getAll();
    const documents = await new Promise<Array<{ rows: number; cols: number; cells: ArrayBuffer }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    const { rows, cols, cells } = documents[0];
    return { rows, cols, filled: [...new Uint32Array(cells).entries()].filter(([, value]) => value).map(([index]) => index) };
  });
}

test('keeps the board on screen when scrolled far, with edge cells reaching the center', async ({ page }) => {
  const scroll = (deltaX: number, deltaY: number) => page.getByLabel('編み図編集盤面').evaluate((element, delta) => {
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: delta.deltaX, deltaY: delta.deltaY }));
  }, { deltaX, deltaY });

  // 盤面を右下へ大きく動かすと、左上のマスが表示領域の中央で止まる。
  await scroll(-100_000, -100_000);
  await clickBoardCenter(page);
  expect((await storedCells(page)).filled).toEqual([0]);

  // 反対へ大きく動かすと、右下のマスが表示領域の中央で止まる。
  await scroll(100_000, 100_000);
  await clickBoardCenter(page);
  const { rows, cols, filled } = await storedCells(page);
  expect(filled).toEqual([0, rows * cols - 1]);
});

test('keeps the board on screen when dragged far with two fingers', async ({ page }) => {
  await page.getByLabel('編み図編集盤面').evaluate((element) => {
    // Synthetic PointerEvents are not registered in the browser's native pointer-capture table.
    element.setPointerCapture = () => {};
    const rect = element.getBoundingClientRect();
    const dispatch = (type: string, pointerId: number, x: number, y: number) => element.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: 'touch',
      clientX: rect.left + x,
      clientY: rect.top + y,
      button: 0,
      isPrimary: pointerId === 1,
    }));
    // 2本指で盤面を左上へ大きく動かす。
    dispatch('pointerdown', 1, 100, 100);
    dispatch('pointerdown', 2, 160, 100);
    dispatch('pointermove', 1, -20_000, -20_000);
    dispatch('pointermove', 2, -19_940, -20_000);
    dispatch('pointerup', 2, -19_940, -20_000);
    dispatch('pointerup', 1, -20_000, -20_000);
  });

  // 右下のマスが表示領域の中央で止まっている。
  await clickBoardCenter(page);
  const { rows, cols, filled } = await storedCells(page);
  expect(filled).toEqual([rows * cols - 1]);
});

test('matches the guidance to the input method and hides the gesture hint after about ten seconds', async ({ page }, testInfo) => {
  const touch = Boolean(testInfo.project.use.hasTouch);
  await page.clock.install();
  await page.reload();
  const hint = page.locator('.gesture-hint');
  if (touch) await expect(hint).toHaveText('1本指：描画　2本指：移動・拡大');
  else await expect(hint).toHaveText(/^ドラッグ：描画　ホイール：移動　(Ctrl|⌘)＋ホイール：拡大$/);

  const undo = page.getByRole('button', { name: '元に戻す' });
  await expect(undo).toHaveAttribute('title', /^元に戻す（(⌘Z|Ctrl\+Z)）$/);

  // キーボードの無いスマホでは、Escapeで閉じる案内を出さない。
  const pickerButton = page.getByRole('button', { name: '編み目記号を選ぶ' });
  if (touch) await pickerButton.tap(); else await pickerButton.click();
  const description = page.locator('#stitch-picker-description');
  await expect(description).toHaveText(touch ? '記号を選ぶと描画モードになります。' : '記号を選ぶと描画モードになります。Escapeで閉じます。');
  await page.getByRole('dialog', { name: '編み目記号' }).getByRole('button', { name: '閉じる' }).click();

  await expect(hint).toBeVisible();
  await page.clock.runFor(9_000);
  await expect(hint).toBeVisible();
  await page.clock.runFor(1_000);
  await expect(hint).toBeHidden();
});

test('erases stitches continuously', async ({ page }) => {
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.move(box!.x + 165, box!.y + 75, { steps: 6 });
  await page.mouse.up();

  await page.getByRole('button', { name: '消す' }).click();
  await expect(page.getByRole('button', { name: '消す' })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.move(box!.x + 165, box!.y + 75, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const remaining = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('documents');
    const get = transaction.objectStore('documents').getAll();
    const documents = await new Promise<Array<{ cells: ArrayBuffer }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    return new Uint32Array(documents[0].cells).filter(Boolean).length;
  });
  expect(remaining).toBe(0);
});

test('selects a stitch from the visual palette and places white-out data', async ({ page }) => {
  await page.getByRole('button', { name: '編み目記号を選ぶ' }).click();
  const picker = page.getByRole('dialog', { name: '編み目記号' });
  await expect(picker).toBeVisible();
  await expect(picker.locator('.stitch-option-symbol svg')).toHaveCount(26);
  await expect(picker.getByRole('button', { name: /裏目の右上2目一度/ })).toBeVisible();
  await picker.getByRole('button', { name: /白くする/ }).click();
  await expect(page.locator('.stitch-tool-name')).toHaveText('白くする');

  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + 75, box!.y + 75);
  await page.waitForTimeout(500);
  const stitchId = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('documents');
    const get = transaction.objectStore('documents').getAll();
    const documents = await new Promise<Array<{ cells: ArrayBuffer }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    return new Uint32Array(documents[0].cells).find(Boolean)! >>> 24;
  });
  expect(stitchId).toBe(25);
});

test('selects and stores the purl right-leaning two-stitch decrease', async ({ page }) => {
  await page.getByRole('button', { name: '編み目記号を選ぶ' }).click();
  const picker = page.getByRole('dialog', { name: '編み目記号' });
  await picker.getByRole('button', { name: /裏目の右上2目一度/ }).click();
  await expect(page.locator('.stitch-tool-name')).toHaveText('裏目の右上2目一度');

  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + 75, box!.y + 75);
  await page.waitForTimeout(500);
  const stitchId = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('documents');
    const get = transaction.objectStore('documents').getAll();
    const documents = await new Promise<Array<{ cells: ArrayBuffer }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    return new Uint32Array(documents[0].cells).find(Boolean)! >>> 24;
  });
  expect(stitchId).toBe(26);
});

test('picks a color used in the chart from the color list and draws with it', async ({ page }) => {
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  const storedColors = async () => {
    await page.waitForTimeout(700);
    return await page.evaluate(async () => {
      const request = indexedDB.open('knitting-editor-v2');
      const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
      const get = db.transaction('documents').objectStore('documents').getAll();
      const documents = await new Promise<Array<{ cells: ArrayBuffer }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
      return [...new Uint32Array(documents[0].cells)].filter(Boolean).map((value) => `#${(value & 0xffffff).toString(16).padStart(6, '0')}`);
    });
  };
  const colorButton = page.getByRole('button', { name: /^記号の色を選ぶ/ });
  const picker = page.getByRole('dialog', { name: '記号の色' });

  // 何も置いていなければ一覧は空で、ほかの色から選ぶ。
  await colorButton.click();
  await expect(picker).toBeVisible();
  await expect(picker.getByText('まだ記号を置いていません。')).toBeVisible();
  await picker.getByRole('button', { name: '閉じる' }).click();
  await expect(picker).toBeHidden();

  await page.mouse.click(box!.x + 75, box!.y + 75);
  await colorButton.click();
  await picker.getByLabel('色を選ぶ').fill('#264653');
  await expect(colorButton).toHaveAccessibleName('記号の色を選ぶ（現在：青緑 #264653）');
  await picker.getByRole('button', { name: '閉じる' }).click();
  await page.mouse.click(box!.x + 140, box!.y + 75);
  expect(await storedColors()).toEqual(['#d33c32', '#264653']);

  // 消すモードからでも、一覧で選べばその色で描けるようになる。
  await page.getByRole('button', { name: '消す' }).click();
  await colorButton.click();
  const swatches = picker.getByRole('group', { name: 'この編み図で使っている色' }).getByRole('button');
  await expect(swatches).toHaveCount(2);
  await expect(swatches.nth(0)).toHaveAccessibleName('赤 #d33c32、記号1個');
  await expect(swatches.nth(1)).toHaveAccessibleName('青緑 #264653、記号1個');
  await expect(swatches.nth(1)).toHaveAttribute('aria-pressed', 'true');
  for (const index of [0, 1]) {
    const swatch = await swatches.nth(index).boundingBox();
    expect(swatch!.width).toBeGreaterThanOrEqual(44);
    expect(swatch!.height).toBeGreaterThanOrEqual(44);
  }
  await swatches.nth(0).click();
  await expect(picker).toBeHidden();
  await expect(colorButton).toHaveAccessibleName('記号の色を選ぶ（現在：赤 #d33c32）');
  await expect(page.getByRole('button', { name: '描く' })).toHaveAttribute('aria-pressed', 'true');

  await page.mouse.click(box!.x + 205, box!.y + 75);
  expect(await storedColors()).toEqual(['#d33c32', '#264653', '#d33c32']);
});

test('creates a block and exports backup and PDF', async ({ page }) => {
  // iPhone相当の設定では共有シートへ渡す（別のテストで確かめる）。ここではダウンロードした`.knit`で往復を確かめる。
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '範囲' }).click();
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  page.once('dialog', async (dialog) => dialog.accept('テストブロック'));
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.move(box!.x + 135, box!.y + 135);
  await page.mouse.up();
  await page.getByRole('button', { name: 'ブロック' }).click();
  await page.getByRole('button', { name: '選択範囲をブロック保存' }).click();
  await expect(page.getByText('テストブロック')).toBeVisible();

  // ブロックの削除は元に戻せないので、確認を断ると残る。
  const blockRow = page.locator('.block-list > div').filter({ hasText: 'テストブロック' });
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('ブロック「テストブロック」を削除しますか？');
    await dialog.dismiss();
  });
  await blockRow.getByRole('button', { name: '削除' }).click();
  await expect(blockRow).toBeVisible();

  await page.getByRole('button', { name: '閉じる' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'この編み図' }).click();
  const backup = await backupDownload;
  expect(backup.suggestedFilename()).toMatch(/\.knit$/);

  const backupPath = await backup.path();
  expect(backupPath).not.toBeNull();
  await page.locator('input[type="file"]').setInputFiles(backupPath!);
  await expect(page.getByText('1件の編み図を復元しました')).toBeVisible();
  // 編み図名のあとに、読み上げ用の保存状態テキストが続く。
  await expect(page.locator('.app-document-name')).toContainText('新しい編み図（復元）');

  await page.getByRole('button', { name: '保存' }).click();
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDFを保存' }).click();
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);
});

test('draws the ten-stitch major lines in the PNG at the numbered tens', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
  await page.reload();
  await page.getByRole('button', { name: '盤面' }).click();
  await page.getByLabel('段数').fill('25');
  await page.getByLabel('列数').fill('23');
  await page.getByRole('button', { name: '変更' }).click();
  await page.getByRole('button', { name: '閉じる' }).click();

  await page.getByRole('button', { name: '保存' }).click();
  // 25段×23目は既定の1セル24pxで、四辺の番号の帯も24px。
  await expect(page.getByText('600×648px')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNGを保存' }).click();
  const png = readFileSync((await (await download).path())!);

  // 盤面の中を縦・横に1本ずつたどり、太線の色（#666）の画素の位置を集める。
  const darkPixels = await page.evaluate(async (base64) => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const canvas = new OffscreenCanvas(image.width, image.height);
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const isDark = (x: number, y: number) => {
      const [red, green, blue] = context.getImageData(x, y, 1, 1).data;
      return red === 0x66 && green === 0x66 && blue === 0x66;
    };
    const rows: number[] = [];
    const cols: number[] = [];
    // 0段目・0目のマスの中央（左上の帯24pxの内側）を通る線でたどる。
    for (let y = 24; y < 24 + 25 * 24; y++) if (isDark(36, y)) rows.push(y);
    for (let x = 24; x < 24 + 23 * 24; x++) if (isDark(x, 36)) cols.push(x);
    return { rows, cols };
  }, png.toString('base64'));
  // 段番号10・20の上の罫線は上端から15本目・5本目、目番号10・20の左の罫線は左端から13本目・3本目。
  // 2pxの太線は罫線の位置の上側（左側）の画素と合わせて2画素になる。
  const line = (index: number) => [24 + index * 24 - 1, 24 + index * 24];
  expect(darkPixels.rows).toEqual([...line(5), ...line(15)]);
  expect(darkPixels.cols).toEqual([...line(3), ...line(13)]);
});

test('hands PNG and PDF to the share sheet on iPhone Safari without leaving the editor', async ({ page }, testInfo) => {
  // iOSのSafariは<a download>のPDFで編集中のタブを置き換えるため、共有シートで渡す。
  // Playwrightのブラウザには共有APIが無いので、iPhone相当の設定で差し替えて確かめる。
  test.skip(testInfo.project.name !== 'webkit-mobile', 'iPhone Safariだけの保存導線');
  await page.addInitScript(() => {
    const shared: Array<Array<[string, string]>> = [];
    Object.assign(window, { sharedFiles: shared });
    Object.assign(navigator, {
      canShare: (data: ShareData) => (data.files?.length ?? 0) > 0,
      share: async (data: ShareData) => { shared.push((data.files ?? []).map((file) => [file.name, file.type])); },
    });
  });
  await page.reload();
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  const editorUrl = page.url();
  const sharedFiles = () => page.evaluate(() => (window as unknown as { sharedFiles: Array<Array<[string, string]>> }).sharedFiles);

  await page.getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: 'PNGを保存' }).click();
  const dialog = page.getByRole('dialog', { name: '「新しい編み図.png」の準備ができました' });
  await expect(dialog).toBeVisible();
  expect(await sharedFiles()).toEqual([]);
  await dialog.getByRole('button', { name: '共有・保存' }).click();
  await expect(dialog).toBeHidden();
  expect(await sharedFiles()).toEqual([[['新しい編み図.png', 'image/png']]]);

  await page.getByRole('button', { name: 'PDFを保存' }).click();
  await page.getByRole('dialog', { name: '「新しい編み図.pdf」の準備ができました' }).getByRole('button', { name: '共有・保存' }).click();
  await expect.poll(sharedFiles).toEqual([[['新しい編み図.png', 'image/png']], [['新しい編み図.pdf', 'application/pdf']]]);

  // 閉じるだけなら共有しない。どの操作でも編集画面のまま残る。
  await page.getByRole('button', { name: 'PDFを保存' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '閉じる' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(await sharedFiles()).toHaveLength(2);
  expect(page.url()).toBe(editorUrl);
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

test('copies and repeatedly pastes a selection without saving a block', async ({ page }) => {
  await page.getByRole('button', { name: '範囲' }).click();
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.move(box!.x + 135, box!.y + 135);
  await page.mouse.up();
  await page.getByRole('button', { name: 'コピーして貼付' }).click();
  await expect(page.getByRole('button', { name: '貼付' })).toBeVisible();
  await page.mouse.click(box!.x + 180, box!.y + 180);
  await expect(page.getByText('ブロックを貼り付けました')).toBeVisible();
  await page.getByRole('button', { name: '貼付' }).click();
  await page.mouse.click(box!.x + 240, box!.y + 180);
  await expect(page.getByText('ブロックを貼り付けました')).toBeVisible();
  await page.getByRole('button', { name: 'ブロック' }).click();
  await expect(page.getByText('保存済みブロックはありません。')).toBeVisible();
});

test('undoes and redoes a stroke and a grid change, then saves the result', async ({ page }) => {
  const readStored = () => page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const get = db.transaction('documents').objectStore('documents').getAll();
    const documents = await new Promise<Array<{ cells: ArrayBuffer; rows: number }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    return { filled: new Uint32Array(documents[0].cells).filter(Boolean).length, rows: documents[0].rows };
  });
  const undo = page.getByRole('button', { name: '元に戻す' });
  const redo = page.getByRole('button', { name: 'やり直す' });
  await expect(undo).toBeDisabled();
  await expect(redo).toBeDisabled();

  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + 75, box!.y + 75);
  await page.mouse.move(box!.x + 75, box!.y + 135);
  await page.mouse.down();
  await page.mouse.move(box!.x + 180, box!.y + 135, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const drawn = await readStored();
  expect(drawn.filled).toBeGreaterThan(2);

  // なぞり描き1回分がまとめて取り消され、その前のタップは残る。
  await undo.click();
  await expect(page.getByRole('status').filter({ hasText: '元に戻しました' })).toBeVisible();
  await page.waitForTimeout(700);
  expect((await readStored()).filled).toBe(1);
  await expect(redo).toBeEnabled();

  await page.keyboard.press('ControlOrMeta+Shift+z');
  await page.waitForTimeout(700);
  expect((await readStored()).filled).toBe(drawn.filled);

  await page.getByRole('button', { name: '盤面' }).click();
  await page.getByRole('button', { name: '上に段' }).click();
  await page.getByRole('button', { name: '閉じる' }).click();
  await page.waitForTimeout(700);
  expect((await readStored()).rows).toBe(21);

  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForTimeout(700);
  expect(await readStored()).toEqual({ filled: drawn.filled, rows: 20 });

  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(undo).toBeDisabled();
  await page.waitForTimeout(700);
  expect(await readStored()).toEqual({ filled: 0, rows: 20 });
});

test('keeps the cast-on row when the row count grows and shrinks again', async ({ page }) => {
  const readFilled = () => page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const transaction = db.transaction('documents');
    const get = transaction.objectStore('documents').getAll();
    const documents = await new Promise<Array<{ cells: ArrayBuffer; rows: number; cols: number }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    const cells = new Uint32Array(documents[0].cells);
    const indexes: number[] = [];
    cells.forEach((value, index) => { if (value) indexes.push(index); });
    return { indexes, rows: documents[0].rows, cols: documents[0].cols };
  });

  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + 75, box!.y + 75);
  await page.waitForTimeout(700);
  const before = await readFilled();
  expect(before.indexes.length).toBe(1);

  // 盤面設定の段数変更は増減のどちらでも上端側で行う。往復しても段番号は変わらない。
  await page.getByRole('button', { name: '盤面' }).click();
  await page.getByLabel('段数').fill('25');
  await page.getByRole('button', { name: '変更' }).click();
  await page.waitForTimeout(700);
  await page.getByLabel('段数').fill('20');
  await page.getByRole('button', { name: '変更' }).click();
  await page.waitForTimeout(700);

  const after = await readFilled();
  expect(after.rows).toBe(before.rows);
  expect(after.cols).toBe(before.cols);
  expect(after.indexes).toEqual(before.indexes);
});

test('does not overwrite a renamed chart with a pending autosave', async ({ page }) => {
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + 75, box!.y + 75);

  await page.getByRole('button', { name: '編み図' }).click();
  page.once('dialog', async (dialog) => dialog.accept('名称変更後'));
  await page.getByRole('button', { name: '名前変更' }).click();
  await page.waitForTimeout(700);

  const names = await page.evaluate(async () => {
    const request = indexedDB.open('knitting-editor-v2');
    const db = await new Promise<IDBDatabase>((resolve) => { request.onsuccess = () => resolve(request.result); });
    const get = db.transaction('documents').objectStore('documents').getAll();
    const documents = await new Promise<Array<{ name: string }>>((resolve) => { get.onsuccess = () => resolve(get.result); });
    return documents.map((document) => document.name);
  });
  expect(names).toContain('名称変更後');
});

test('keeps header actions visible when text is enlarged in landscape', async ({ page }) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.addStyleTag({ content: 'html { font-size: 32px; }' });

  const layout = await page.locator('.app-header').evaluate((header) => {
    const headerRect = header.getBoundingClientRect();
    const actions = header.querySelector<HTMLElement>('.header-actions')!.getBoundingClientRect();
    const button = header.querySelector<HTMLElement>('.header-document')!;
    return {
      headerTop: headerRect.top,
      headerBottom: headerRect.bottom,
      actionsTop: actions.top,
      actionsBottom: actions.bottom,
      buttonFontSize: Number.parseFloat(getComputedStyle(button).fontSize),
    };
  });
  expect(layout.headerTop).toBeGreaterThanOrEqual(0);
  expect(layout.actionsTop).toBeGreaterThanOrEqual(layout.headerTop);
  expect(layout.actionsBottom).toBeLessThanOrEqual(layout.headerBottom);
  expect(layout.buttonFontSize).toBeLessThanOrEqual(20);
});

test('resizes to one million cells without creating cell DOM nodes', async ({ page }) => {
  await page.getByRole('button', { name: '盤面' }).click();
  await page.getByLabel('段数').fill('1000');
  await page.getByLabel('列数').fill('1000');
  await page.getByRole('button', { name: '変更' }).click();
  await expect(page.locator('.board-canvas')).toHaveCount(1);
  expect(await page.locator('.cell').count()).toBe(0);
});

test('describes the board and the current mode for assistive technology', async ({ page }) => {
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toHaveAttribute('role', 'application');
  await expect(canvas).toHaveAttribute('aria-label', /20段、20目。記号0個。描画モード。選択範囲なし/);
  await expect(page.locator('#board-instructions')).toHaveText(/現在は描画モードです/);
  await expect(canvas).toHaveAttribute('aria-describedby', 'board-instructions');

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('aria-label', /記号1個/);

  await page.getByRole('button', { name: '消す', exact: true }).click();
  await expect(canvas).toHaveAttribute('aria-label', /消去モード/);
  await expect(page.locator('#board-instructions')).toHaveText(/現在は消去モードです/);
});


for (const action of ['switch', 'restore'] as const) {
  test(`preserves unsaved edits when ${action} cannot save`, async ({ page }) => {
    await page.getByRole('button', { name: '編み図', exact: true }).click();
    await page.getByRole('button', { name: '複製', exact: true }).click();
    await expect(page.locator('.document')).toHaveCount(2);
    await page.getByRole('button', { name: '閉じる', exact: true }).click();
    await page.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'documents') throw new DOMException('test quota', 'QuotaExceededError');
        return original.apply(this, args);
      };
    });
    const canvas = page.getByLabel('編み図編集盤面');
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + 75, box!.y + 75);
    await expect(page.locator('.app-document-name')).toContainText('保存中');
    if (action === 'switch') {
      await page.getByRole('button', { name: '編み図', exact: true }).click();
      await page.locator('.document').filter({ hasText: 'コピー' }).locator('button').first().click();
      await expect(page.locator('.drawer')).toBeVisible();
    } else {
      const fixture = readFileSync('ios/test-fixtures/knitting-editor-v2-interop.knit.b64', 'utf8').trim();
      await page.locator('input[type="file"]').setInputFiles({
        name: 'restore.knit', mimeType: 'application/gzip', buffer: Buffer.from(fixture, 'base64'),
      });
      await expect(page.locator('.busy')).toHaveCount(0);
      await page.getByRole('button', { name: '編み図', exact: true }).click();
      await expect(page.locator('.document')).toHaveCount(2);
    }
    await expect(page.locator('.app-document-name')).toContainText('新しい編み図');
    await expect(page.locator('.app-document-name')).not.toContainText('コピー');
    await expect(page.locator('.app-document-name')).toContainText('保存中');
    await expect(page.locator('.toast')).toContainText('保存');
  });
}

test('explains why a switch is blocked by an edit that lands during the save', async ({ page }) => {
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await page.getByRole('button', { name: '複製', exact: true }).click();
  await expect(page.locator('.document')).toHaveCount(2);
  await page.getByRole('button', { name: '閉じる', exact: true }).click();

  // 書き込みが始まるたびに次の編集を差し込み、「保存は成功したが、その最中に
  // 編集が入った」状態を決定的に作る。盤面を差し替える操作はここで止まる。
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.board-canvas')!;
    // Synthetic PointerEvents are not registered in the browser's native pointer-capture table.
    canvas.setPointerCapture = () => {};
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
      const request = original.apply(this, args);
      if (this.name === 'documents') {
        const rect = canvas.getBoundingClientRect();
        for (const type of ['pointerdown', 'pointerup']) {
          canvas.dispatchEvent(new PointerEvent(type, {
            bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch',
            clientX: rect.left + 135, clientY: rect.top + 135, button: 0, isPrimary: true,
          }));
        }
      }
      return request;
    };
  });

  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + 75, box!.y + 75);
  await expect(page.locator('.app-document-name')).toContainText('保存中');

  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await page.locator('.document').filter({ hasText: 'コピー' }).locator('button').first().click();

  await expect(page.locator('.toast')).toContainText('編集中のため切り替えできませんでした');
  await expect(page.locator('.app-document-name')).toContainText('新しい編み図');
  await expect(page.locator('.app-document-name')).not.toContainText('コピー');
  await expect(page.locator('.drawer')).toBeVisible();
});
