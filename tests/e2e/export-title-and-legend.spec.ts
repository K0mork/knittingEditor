import { readFileSync } from 'node:fs';
import { downloadInsteadOfShare, expect, test } from './fixtures';

test('keeps empty tiled PDF page counts unchanged when title and legend are enabled', async ({ page }) => {
  await downloadInsteadOfShare(page);
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '出力', exact: true }).click();
  await page.getByRole('combobox', { name: '構成' }).selectOption('tiled');
  const option = page.getByRole('checkbox', { name: '編み図名と記号の一覧を入れる' });
  let plainPages: number | undefined;
  for (const enabled of [false, true]) {
    await option.setChecked(enabled);
    const estimate = Number((await page.getByText(/^推定 \d+ページ/).textContent())!.match(/推定 (\d+)/)![1]);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDFを保存', exact: true }).click();
    const pdf = await download;
    expect(await pdf.failure()).toBeNull();
    const bytes = readFileSync((await pdf.path())!);
    const actualPages = Number(bytes.toString('latin1').match(/\/Count (\d+)/)![1]);
    expect(actualPages).toBe(estimate);
    if (enabled) expect(actualPages).toBe(plainPages);
    else plainPages = actualPages;
  }
});

test('exports PNG and single/tiled PDF with the optional title and legend on and off', async ({ page }) => {
  await downloadInsteadOfShare(page);
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: Math.min(75, box!.width - 10), y: Math.min(75, box!.height - 10) } });
  await page.getByRole('button', { name: '出力', exact: true }).click();
  const option = page.getByRole('checkbox', { name: '編み図名と記号の一覧を入れる' });
  await expect(option).not.toBeChecked();
  let plainPng: Buffer | undefined;
  let plainTiledPages: number | undefined;
  for (const enabled of [false, true, false]) {
    await option.setChecked(enabled);
    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNGを保存', exact: true }).click();
    const png = await pngDownload;
    expect(png.suggestedFilename()).toMatch(/\.png$/);
    expect(await png.failure()).toBeNull();
    const bytes = readFileSync((await png.path())!);
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (enabled) {
      expect(width).toBeGreaterThanOrEqual(plainPng!.readUInt32BE(16));
      expect(height).toBeGreaterThan(plainPng!.readUInt32BE(20));
    } else if (plainPng) {
      expect(bytes).toEqual(plainPng);
    } else {
      plainPng = bytes;
    }
    for (const layout of ['single', 'tiled']) {
      await page.getByRole('combobox', { name: '構成' }).selectOption(layout);
      const estimate = Number((await page.getByText(/^推定 \d+ページ/).textContent())!.match(/推定 (\d+)/)![1]);
      const pdfDownload = page.waitForEvent('download');
      await page.getByRole('button', { name: 'PDFを保存', exact: true }).click();
      const pdf = await pdfDownload;
      expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
      expect(await pdf.failure()).toBeNull();
      const pdfBytes = readFileSync((await pdf.path())!);
      expect(pdfBytes.subarray(0, 8).toString()).toBe('%PDF-1.7');
      expect(pdfBytes.length).toBeGreaterThan(100);
      const actualPages = Number(pdfBytes.toString('latin1').match(/\/Count (\d+)/)![1]);
      expect(actualPages).toBe(estimate);
      if (layout === 'tiled') {
        if (enabled) expect(actualPages).toBe(plainTiledPages! + 1);
        else if (plainTiledPages !== undefined) expect(actualPages).toBe(plainTiledPages);
        else plainTiledPages = actualPages;
      }
    }
  }
});

test('catches the shown PNG size up with the legend after drawing while the export panel is open', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'webkit-mobile', 'iPhone 14の幅では出力パネルが盤面のほぼ全体を覆い、開いたまま記号を置けない');
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面');
  await expect(canvas).toBeVisible();
  const exportPanel = page.getByRole('button', { name: '出力', exact: true });
  const option = page.getByRole('checkbox', { name: '編み図名と記号の一覧を入れる' });
  const size = page.getByText(/^\d+×\d+px/);
  await exportPanel.click();
  await option.check();
  const empty = (await size.textContent())!;
  // 出力パネルを開いたまま記号を置くと、変更が止まってから一覧を数え直し、寸法の表示が追いつく。
  // 狭い画面ではパネルが盤面の一部に重なるので、段・目番号の帯を避け、パネルに覆われていない盤面の点を押す。
  const position = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    for (let y = rect.top + 75; y < Math.min(rect.bottom, innerHeight) - 10; y += 20) {
      for (let x = rect.left + 75; x < Math.min(rect.right, innerWidth) - 10; x += 20) {
        if (document.elementFromPoint(x, y) === element) return { x: x - rect.left, y: y - rect.top };
      }
    }
    return undefined;
  });
  expect(position).toBeDefined();
  await canvas.click({ position });
  await expect(size).not.toHaveText(empty);
  const shown = (await size.textContent())!;
  // パネルを開き直して数えた表示と一致する。
  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  await exportPanel.click();
  await option.check();
  await expect(size).toHaveText(shown);
});
