import { expect, test } from './fixtures';

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

test('labels stay separated at minimum zoom and grow with the root font', async ({ page }, testInfo) => {
  await page.evaluate(() => document.documentElement.style.setProperty('font-size', '32px', 'important'));
  const canvas = page.getByLabel('編み図編集盤面');
  await canvas.evaluate((element) => element.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: 10000, clientX: 200, clientY: 200,
  })));
  await page.waitForTimeout(100);
  await testInfo.attach('large-text-minimum-zoom', { body: await canvas.screenshot(), contentType: 'image/png' });
  await canvas.evaluate((element) => element.dispatchEvent(new WheelEvent('wheel', {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: -10000, clientX: 200, clientY: 200,
  })));
  await testInfo.attach('large-text-maximum-zoom', { body: await canvas.screenshot(), contentType: 'image/png' });
});
