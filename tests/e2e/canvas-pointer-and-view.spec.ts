import { expect, test } from './fixtures';

test.use({ viewport: { width: 390, height: 844 } });

test('right drag erases only its pressed cell and leaves left drawing and history shortcuts working', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  // 初期表示の右下端から、30pxのセル中心を求める。
  const right = Math.min(36 + 600, box.width - 8);
  const bottom = Math.min(36 + 600, box.height - 8);
  const y = box.y + bottom - 15;
  const x = box.x + right - 15;
  await page.mouse.click(x, y);
  await page.mouse.click(x - 30, y);
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x - 60, y, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await expect(canvas).toHaveAttribute('aria-label', /記号1個/);
  await page.mouse.click(x - 30, y, { button: 'right' });
  await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 5 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('aria-label', /記号3個/);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(canvas).toHaveAttribute('aria-label', /記号3個/);
  await page.getByRole('button', { name: '範囲', exact: true }).click();
  await page.mouse.click(x, y);
  await page.keyboard.press('ControlOrMeta+c');
  // 貼付帯が出た後の盤面位置を測り、案内に重ならない上の段へ貼付する。
  const pastePoint = async () => {
    await expect(page.getByRole('toolbar', { name: '貼付の操作' })).toBeVisible();
    const current = (await canvas.boundingBox())!;
    return { x: x + current.x - box.x, y: y + current.y - box.y - 120 };
  };
  let target = await pastePoint();
  const hitsCanvas = (pointX: number) => page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.classList.contains('board-canvas') ?? false, [pointX, target.y]);
  expect(await hitsCanvas(target.x)).toBe(true);
  await page.mouse.click(target.x, target.y);
  await expect(canvas).toHaveAttribute('aria-label', /記号4個/);
  await page.keyboard.press('ControlOrMeta+v');
  target = await pastePoint();
  expect(await hitsCanvas(target.x - 30)).toBe(true);
  await page.mouse.click(target.x - 30, target.y);
  await expect(canvas).toHaveAttribute('aria-label', /記号5個/);
});

test('right drag in erase mode still erases along the drag', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const x = box.x + Math.min(636, box.width - 8) - 15;
  const y = box.y + Math.min(636, box.height - 8) - 15;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y, { steps: 8 });
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('aria-label', /記号5個/);
  await page.getByRole('button', { name: '消す', exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(x - 60, y, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
});

test('initial narrow view draws stitch 1 and row 1 labels and retains zoom on resize', async ({ page }) => {
  await page.addInitScript(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    const labels: { text: string; x: number; y: number }[] = [];
    Object.assign(window, { canvasNumberLabels: labels });
    CanvasRenderingContext2D.prototype.clearRect = function (x, y, width, height) {
      if (this.canvas.classList.contains('board-canvas')) labels.length = 0;
      clear.call(this, x, y, width, height);
    };
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.classList.contains('board-canvas')) labels.push({ text, x, y });
      if (maxWidth === undefined) original.call(this, text, x, y);
      else original.call(this, text, x, y, maxWidth);
    };
  });
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const labels = (window as unknown as { canvasNumberLabels: { text: string; x: number; y: number }[] }).canvasNumberLabels;
    return labels.some((label) => label.text === '1' && label.y === 14 && label.x > 28)
      && labels.some((label) => label.text === '1' && label.x === 14 && label.y > 28);
  })).toBe(true);
  // モバイルWebKitではpage.mouse.wheelが使えないので、ほかのテストと同じくCtrl付きのwheelを送る。
  await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100,
      clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
    }));
  });
  const cellSize = () => page.evaluate(() => {
    const labels = (window as unknown as { canvasNumberLabels: { text: string; x: number; y: number }[] }).canvasNumberLabels;
    const columns = labels.filter((label) => label.y === 14).sort((a, b) => a.x - b.x);
    if (columns.length < 2) return 0;
    return (columns[1].x - columns[0].x) / (Number(columns[0].text) - Number(columns[1].text));
  });
  await expect.poll(cellSize).toBeGreaterThan(30);
  const zoomedCellSize = await cellSize();
  // 回転相当の幅変更後にも編集盤面と名前が維持される。
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(canvas).toHaveAttribute('aria-label', /20段、20目/);
  await expect.poll(cellSize).toBeCloseTo(zoomedCellSize, 5);
});

test('Tab skips the canvas while its state remains accessible', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('role', 'region');
  expect(await canvas.getAttribute('tabindex')).toBeNull();
  for (let index = 0; index < 40; index++) {
    await page.keyboard.press('Tab');
    expect(await canvas.evaluate((element) => document.activeElement === element)).toBe(false);
  }
});

test('a left stroke resumes after crossing the number band without drawing across the gap', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const x = box.x + Math.min(636, box.width - 8) - 15;
  const y = box.y + Math.min(636, box.height - 8) - 15;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 1, y);
  await page.mouse.move(box.x + 12, y);
  await page.mouse.move(x - 90, y);
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
});

for (const rootFontSize of [32, 48]) {
  test(`row numbers of a 1000-row board fit the capped band at a ${rootFontSize}px root font`, async ({ page }) => {
    await page.addInitScript(() => {
      const original = CanvasRenderingContext2D.prototype.fillText;
      const clear = CanvasRenderingContext2D.prototype.clearRect;
      const labels: { text: string; x: number; y: number; width: number }[] = [];
      Object.assign(window, { canvasNumberLabels: labels });
      CanvasRenderingContext2D.prototype.clearRect = function (x, y, width, height) {
        if (this.canvas.classList.contains('board-canvas')) labels.length = 0;
        clear.call(this, x, y, width, height);
      };
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        if (this.canvas.classList.contains('board-canvas')) labels.push({ text, x, y, width: this.measureText(text).width });
        if (maxWidth === undefined) original.call(this, text, x, y);
        else original.call(this, text, x, y, maxWidth);
      };
    });
    await page.goto('/');
    const canvas = page.getByLabel('編み図編集盤面');
    await expect(canvas).toBeVisible();
    await page.getByRole('button', { name: '盤面' }).click();
    await page.getByLabel('段数').fill('1000');
    await page.getByRole('button', { name: '変更' }).click();
    await expect(canvas).toHaveAttribute('aria-label', /1000段/);
    await page.evaluate((size) => document.documentElement.style.setProperty('font-size', `${size}px`, 'important'), rootFontSize);
    // 帯は既定の28pxの1.5倍（42px）で止まり、段番号はその中央（x = 21）に描かれる。
    const band = 42;
    const rowLabels = () => page.evaluate((center) => {
      const labels = (window as unknown as { canvasNumberLabels: { text: string; x: number; y: number; width: number }[] }).canvasNumberLabels;
      return labels.filter((label) => label.x === center && label.y > center * 2);
    }, band / 2);
    await expect.poll(async () => (await rowLabels()).some((label) => label.text.length >= 3)).toBe(true);
    const labels = await rowLabels();
    for (const label of labels) expect(label.width + 8, label.text).toBeLessThanOrEqual(band + 0.01);
  });
}
