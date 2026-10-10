import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

for (const width of [390, 820, 1280]) {
  for (const fontSize of [16, 24]) {
    test(`keeps every picker SVG inside its symbol slot at ${width}px and ${fontSize}px text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((size) => { document.documentElement.style.fontSize = `${size}px`; }, fontSize);
      await page.getByRole('button', { name: '編み目記号を選ぶ' }).click();
      const options = page.getByRole('dialog', { name: '編み目記号' }).locator('.stitch-option');
      await expect(options).toHaveCount(26);
      for (const option of await options.all()) {
        await option.scrollIntoViewIfNeeded();
        const bounds = await option.evaluate((element) => {
          const rect = (selector: string) => {
            const { top, left, right, bottom, width, height } = element.querySelector(selector)!.getBoundingClientRect();
            return { top, left, right, bottom, width, height };
          };
          return { slot: rect('.stitch-option-symbol'), svg: rect('svg'), name: rect('.stitch-option-name'), size: rect('small') };
        });
        expect(bounds.svg.width).toBeGreaterThan(0);
        expect(bounds.svg.height).toBeGreaterThan(0);
        expect(bounds.svg.left).toBeGreaterThanOrEqual(bounds.slot.left - 0.5);
        expect(bounds.svg.right).toBeLessThanOrEqual(bounds.slot.right + 0.5);
        expect(bounds.svg.top).toBeGreaterThanOrEqual(bounds.slot.top - 0.5);
        expect(bounds.svg.bottom).toBeLessThanOrEqual(bounds.slot.bottom + 0.5);
        expect(bounds.svg.bottom).toBeLessThanOrEqual(bounds.name.top + 0.5);
        expect(bounds.svg.bottom).toBeLessThanOrEqual(bounds.size.top + 0.5);
      }
    });
  }
}

test('excludes whiteout stored colors from the used color list and keeps visible color selection', async ({ page }) => {
  const colorButton = page.getByRole('button', { name: /^記号の色を選ぶ/ });
  const colors = page.getByRole('dialog', { name: '記号の色' });
  const swatches = colors.getByRole('group', { name: 'この編み図で使っている色' }).getByRole('button');
  const chooseColor = async (hex: string) => {
    await colorButton.click();
    await colors.getByLabel('色を選ぶ').fill(hex);
    await colors.getByRole('button', { name: '閉じる' }).click();
  };
  const chooseStitch = async (name: RegExp) => {
    await page.getByRole('button', { name: '編み目記号を選ぶ' }).click();
    await page.getByRole('dialog', { name: '編み目記号' }).getByRole('button', { name }).click();
  };
  const canvas = page.getByLabel('編み図編集盤面');
  const box = await canvas.boundingBox();
  await chooseStitch(/白くする/);
  await chooseColor('#ff0000');
  await page.mouse.click(box!.x + 75, box!.y + 75);
  await chooseColor('#0000ff');
  await page.mouse.click(box!.x + 105, box!.y + 75);
  await expect(canvas).toHaveAttribute('aria-label', /。記号2個。/);
  await colorButton.click();
  await expect(swatches).toHaveCount(0);
  await colors.getByRole('button', { name: '閉じる' }).click();

  await chooseStitch(/^表目/);
  await chooseColor('#000000');
  await page.mouse.click(box!.x + 135, box!.y + 75);
  await chooseColor('#ffffff');
  await page.mouse.click(box!.x + 165, box!.y + 75);
  await colorButton.click();
  await expect(swatches).toHaveCount(2);
  await expect(swatches.nth(0)).toHaveAccessibleName('黒 #000000、記号1個');
  await expect(swatches.nth(1)).toHaveAccessibleName('白 #ffffff、記号1個');
  await swatches.nth(0).click();
  await expect(colors).toBeHidden();
  await expect(colorButton).toHaveAccessibleName('記号の色を選ぶ（現在：黒 #000000）');
  await page.mouse.click(box!.x + 195, box!.y + 75);
  await colorButton.click();
  await expect(swatches.nth(0)).toHaveAccessibleName('黒 #000000、記号2個');
  await expect(swatches.nth(0)).toHaveAttribute('aria-pressed', 'true');
});
