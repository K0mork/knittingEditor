import { expect, test } from './fixtures';

for (const width of [390, 760, 1024, 1280]) {
  for (const fontSize of [16, 28, 48]) {
    // 最大文字の右列と、狭い画面で折り返す操作メニューを確かめる。390pxの48pxはiPhoneの最大文字に近い縦長の画面にする。
    const height = width === 390 ? (fontSize === 48 ? 844 : 664) : 1024;
    test(`keeps selection and action controls separate at ${width}x${height} with ${fontSize}px text`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const canvas = page.getByLabel('編み図編集盤面');
      await expect(canvas).toBeVisible();
      await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, fontSize);
      const actionBar = page.locator('.action-bar');
      const normal = await actionBar.boundingBox();
      await page.getByRole('button', { name: '範囲', exact: true }).click();
      const box = (await canvas.boundingBox())!;
      // 番号帯と余白は幅で変わるので、盤面の中心からドラッグする。
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      await page.mouse.move(centerX - 40, centerY - 40);
      await page.mouse.down();
      await page.mouse.move(centerX + 20, centerY + 20);
      await page.mouse.up();
      await expect(page.getByRole('toolbar', { name: '選択範囲の操作' })).toBeVisible();
      // 選択操作帯が縦の空きを使い切らず、選んだ範囲が見える高さの盤面が残る。
      expect((await canvas.boundingBox())!.height, '選択中も盤面が見える').toBeGreaterThanOrEqual(120);
      for (const name of ['コピーして貼付', '解除', '盤面', 'ブロック', '保存']) {
        const button = page.getByRole('button', { name, exact: true });
        expect(await button.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }), `${name} の中心が覆われない`).toBe(true);
      }
      if (width >= 760) {
        expect(await actionBar.evaluate((element) => {
          return [...element.querySelectorAll('button')].every((button) => {
            if (button.scrollWidth > button.clientWidth) return false;
            const bounds = button.getBoundingClientRect();
            const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) {
              if (!walker.currentNode.textContent?.trim()) continue;
              const range = document.createRange();
              range.selectNodeContents(walker.currentNode);
              const text = range.getBoundingClientRect();
              if (text.width > 0 && (text.left < bounds.left || text.right > bounds.right)) return false;
            }
            return true;
          });
        }), '右列の名前が切れない').toBe(true);
      }
      await page.getByRole('button', { name: 'ブロック', exact: true }).click();
      await expect(page.getByRole('button', { name: '選択範囲をブロック保存' })).toBeEnabled();
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      await page.getByRole('button', { name: '解除', exact: true }).click();
      await expect(page.locator('.selection-actions')).toHaveCount(0);
      expect(await actionBar.boundingBox()).toEqual(normal);
    });
  }
}

test('limits hover emphasis to hover-capable input while preserving selection', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: '盤面', exact: true });
  const initialBorder = await button.evaluate((element) => getComputedStyle(element).borderColor);
  const canHover = await page.evaluate(() => matchMedia('(hover: hover)').matches);
  await button.hover();
  const hoveredBorder = await button.evaluate((element) => getComputedStyle(element).borderColor);
  if (canHover) expect(hoveredBorder).not.toBe(initialBorder);
  else expect(hoveredBorder).toBe(initialBorder);
  await button.click();
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.getByRole('button', { name: '描く', exact: true })).toHaveAttribute('aria-pressed', 'true');
  if (!canHover) {
    await button.hover();
    expect(await button.evaluate((element) => getComputedStyle(element).borderColor)).toBe(initialBorder);
  }
});
