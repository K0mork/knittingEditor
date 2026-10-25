import { expect, test, type Page } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

for (const mode of ['描く', '消す', '範囲', 'paste']) {
  test(`number bands do not edit or select in ${mode} mode after scrolling`, async ({ page }) => {
    const canvas = page.getByLabel('編み図編集盤面');
    if (mode === 'paste') {
      await canvas.click({ position: { x: 75, y: 75 } });
      await page.getByRole('button', { name: '範囲', exact: true }).click();
      await canvas.click({ position: { x: 75, y: 75 } });
      await page.getByRole('button', { name: 'コピーして貼付', exact: true }).click();
      await expect(page.getByRole('toolbar', { name: '貼付の操作' })).toBeVisible();
    } else if (mode === '消す') {
      // Fill the top-left cells, which the bands cover after scrolling at every viewport size.
      for (let row = 0; row < 3; row += 1) {
        for (let col = 0; col < 3; col += 1) await canvas.click({ position: { x: 51 + col * 30, y: 51 + row * 30 } });
      }
      await page.getByRole('button', { name: mode, exact: true }).click();
    } else if (mode !== '描く') {
      await page.getByRole('button', { name: mode, exact: true }).click();
    }
    await canvas.evaluate((element) => element.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, deltaY: 60, deltaX: 60,
    })));
    const before = await canvas.getAttribute('aria-label');
    const undo = page.getByRole('button', { name: '元に戻す', exact: true });
    const undoBefore = await undo.isEnabled();
    await canvas.click({ position: { x: 50, y: 12 } });
    await canvas.click({ position: { x: 12, y: 50 } });
    await expect(canvas).toHaveAttribute('aria-label', before!);
    expect(await undo.isEnabled()).toBe(undoBefore);
  });
}

for (const mode of ['描く', '消す', '範囲']) {
  test(`a second touch cancels first-finger micro-movement in ${mode} mode`, async ({ page }) => {
    const canvas = page.getByLabel('編み図編集盤面');
    if (mode === '消す') await canvas.click({ position: { x: 200, y: 200 } });
    if (mode !== '描く') await page.getByRole('button', { name: mode, exact: true }).click();
    if (mode === '範囲') {
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + 75, box.y + 75);
      await page.mouse.down();
      await page.mouse.move(box.x + 165, box.y + 165);
      await page.mouse.up();
    }
    const before = await canvas.getAttribute('aria-label');
    await canvas.evaluate(async (element) => {
      element.setPointerCapture = () => {};
      const rect = element.getBoundingClientRect();
      // Deliver each event in its own frame, as a real touch screen does, so React applies every update in between.
      const dispatch = async (type: string, id: number, x: number, y: number) => {
        element.dispatchEvent(new PointerEvent(type, {
          bubbles: true, pointerId: id, pointerType: 'touch', clientX: rect.left + x, clientY: rect.top + y, button: 0,
        }));
        await new Promise(requestAnimationFrame);
      };
      await dispatch('pointerdown', 1, 200, 200);
      await dispatch('pointermove', 1, 203, 202);
      await dispatch('pointerdown', 2, 260, 200);
      await dispatch('pointermove', 2, 280, 220);
      await dispatch('pointerup', 2, 280, 220);
      await dispatch('pointerup', 1, 203, 202);
    });
    await expect(canvas).toHaveAttribute('aria-label', before!);
  });
}

interface DrawnLabel { text: string; x: number; y: number; width: number; fontSize: number }
type LabelLogWindow = Window & { boardLabels: DrawnLabel[] };

/** 盤面のCanvasに最後に描いた番号（`fillText`）を記録する。描くたびに`clearRect`から数え直す。 */
async function recordBoardLabels(page: Page) {
  await page.addInitScript(() => {
    const fill = CanvasRenderingContext2D.prototype.fillText;
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    const labels: DrawnLabel[] = [];
    Object.assign(window, { boardLabels: labels });
    CanvasRenderingContext2D.prototype.clearRect = function (x, y, width, height) {
      if (this.canvas.classList.contains('board-canvas')) labels.length = 0;
      clear.call(this, x, y, width, height);
    };
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      if (this.canvas.classList.contains('board-canvas')) {
        labels.push({ text, x, y, width: this.measureText(text).width, fontSize: Number.parseFloat(this.font) });
      }
      if (maxWidth === undefined) fill.call(this, text, x, y);
      else fill.call(this, text, x, y, maxWidth);
    };
  });
}

/**
 * 最後に描いた番号を、帯の幅と、目番号（上の帯の中央 y = 帯/2）・段番号（左の帯の中央 x = 帯/2）に分けて読む。
 * 左上の角には番号を描かないので、座標の最小値が帯の中央になる。
 */
async function readLabels(page: Page) {
  const labels = await page.evaluate(() => [...(window as unknown as LabelLogWindow).boardLabels]);
  const band = labels.length ? Math.min(...labels.map((label) => Math.min(label.x, label.y))) * 2 : 0;
  return {
    band,
    columns: labels.filter((label) => label.y === band / 2).sort((a, b) => a.x - b.x),
    rows: labels.filter((label) => label.x === band / 2).sort((a, b) => a.y - b.y),
  };
}
type Labels = Awaited<ReturnType<typeof readLabels>>;

/** 目番号・段番号がどちらも2つ以上あり、すべて`stride`の倍数か。 */
const thinnedTo = (stride: number) => ({ columns, rows }: Labels) => columns.length >= 2 && rows.length >= 2
  && [...columns, ...rows].every((label) => Number(label.text) % stride === 0);

/** 目番号・段番号がどちらも2つ以上あり、間引かずに連続しているか（右下が1なので、並び順では1ずつ減る）。 */
const consecutive = ({ columns, rows }: Labels) => [columns, rows].every((labels) => labels.length >= 2
  && labels.slice(1).every((label, index) => Number(labels[index].text) - Number(label.text) === 1));

/** 隣り合う番号の文字が重ならないことを確かめる。目番号は文字の幅、段番号は文字の大きさで測る。 */
function expectSeparated({ columns, rows }: Labels) {
  for (let index = 1; index < columns.length; index += 1) {
    const [left, right] = [columns[index - 1], columns[index]];
    expect(right.x - right.width / 2 - (left.x + left.width / 2), `目番号${left.text}と${right.text}の間`).toBeGreaterThan(0);
  }
  for (let index = 1; index < rows.length; index += 1) {
    const [upper, lower] = [rows[index - 1], rows[index]];
    expect(lower.y - upper.y - (upper.fontSize + lower.fontSize) / 2, `段番号${upper.text}と${lower.text}の間`).toBeGreaterThan(0);
  }
}

/** 盤面へ`ctrlKey`付きのホイール（拡大・縮小）を送り、番号が`ready`を満たすまで描き直されるのを待つ。 */
async function zoomUntil(page: Page, deltaY: number, ready: (labels: Labels) => boolean) {
  await page.getByLabel('編み図編集盤面').evaluate((element, delta) => element.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: delta, clientX: 200, clientY: 200,
  })), deltaY);
  await expect.poll(async () => ready(await readLabels(page))).toBe(true);
  return readLabels(page);
}

test('labels stay separated at minimum zoom and grow with the root font', async ({ page }, testInfo) => {
  await recordBoardLabels(page);
  await page.reload();
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await readLabels(page)).columns.length).toBeGreaterThan(0);
  const defaultLabels = await readLabels(page);

  // ルートの文字を大きくすると、番号の文字と帯が大きくなる。
  await page.evaluate(() => document.documentElement.style.setProperty('font-size', '32px', 'important'));
  await expect.poll(async () => (await readLabels(page)).band).toBeGreaterThan(defaultLabels.band);
  const largeLabels = await readLabels(page);
  expect(largeLabels.columns[0].fontSize).toBeGreaterThan(defaultLabels.columns[0].fontSize);
  expect(largeLabels.rows[0].fontSize).toBeGreaterThan(defaultLabels.rows[0].fontSize);

  // 最小倍率では番号を10の倍数だけに間引き、大きな文字でも隣と重ならない。
  const minimum = await zoomUntil(page, 10_000, thinnedTo(10));
  expect(minimum.band).toBe(largeLabels.band);
  expectSeparated(minimum);
  await testInfo.attach('large-text-minimum-zoom', { body: await canvas.screenshot(), contentType: 'image/png' });

  // 最大倍率では番号を間引かず、すべての番号を重ならずに描く。
  const maximum = await zoomUntil(page, -10_000, consecutive);
  expectSeparated(maximum);
  await testInfo.attach('large-text-maximum-zoom', { body: await canvas.screenshot(), contentType: 'image/png' });
});
