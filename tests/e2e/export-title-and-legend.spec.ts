import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

test('keeps empty tiled PDF page counts unchanged when title and legend are enabled', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
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
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
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
