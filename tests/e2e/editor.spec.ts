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

test('erases stitches continuously', async ({ page }) => {
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await page.mouse.move(box!.x + 75, box!.y + 75);
  await page.mouse.down();
  await page.mouse.move(box!.x + 165, box!.y + 75, { steps: 6 });
  await page.mouse.up();

  await page.getByRole('button', { name: '消す' }).click();
  await expect(page.getByText('1本指：消去', { exact: false })).toBeVisible();
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

test('creates a block and exports backup and PDF', async ({ page }) => {
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
