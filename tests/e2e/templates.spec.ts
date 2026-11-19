import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pdfStreams } from '../../packages/editor-core/export/pdfStreams.test-helper';
import { downloadInsteadOfShare, expect, test } from './fixtures';

/** 配布しているテンプレート。`scripts/generate-templates.mjs`の定義と名前をそろえる。 */
const TEMPLATES = [
  { slug: 'seed', name: '鹿の子編み' },
  { slug: 'stockinette', name: 'メリヤス編み' },
  { slug: 'rib-1x1', name: '1目ゴム編み' },
  { slug: 'rib-2x2', name: '2目ゴム編み' },
  { slug: 'cable-2x2', name: '2/2ケーブル' },
  { slug: 'twist', name: 'ねじり目の列' },
  { slug: 'nordic', name: '北欧の小モチーフ' },
  { slug: 'checker', name: '市松（配色）' },
];

test('lists every template with a preview and a download link', async ({ page }) => {
  await page.goto('/templates/');
  await expect(page).toHaveTitle('編み図テンプレート｜棒針編み図エディタ');
  await expect(page.locator('article.template')).toHaveCount(TEMPLATES.length);

  for (const { slug } of TEMPLATES) {
    await expect(page.locator(`article.template img[src="/templates/${slug}.svg"]`)).toHaveCount(1);
    await expect(page.locator(`a[href="/templates/${slug}.knit"]`)).toHaveAttribute('download', '');
  }

  // プレビューはすべて読み込めている。
  expect(await page.locator('article.template img').evaluateAll(
    (images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true);
});

test('serves each template as a gzip backup', async ({ request }) => {
  for (const { slug } of TEMPLATES) {
    const response = await request.get(`/templates/${slug}.knit`);
    expect(response.status()).toBe(200);
    const body = await response.body();
    // gzipの先頭2バイト。`.knit`はgzip圧縮したJSONである。
    expect([body[0], body[1]]).toEqual([0x1f, 0x8b]);
  }
});

test('restores a downloaded template in the editor', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('button', { name: '出力', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../../public/templates/seed.knit', import.meta.url)));

  await expect(page.getByText('1件の編み図を復元しました', { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.app-header')).toContainText('鹿の子編み（復元）');
});

for (const { slug, name } of TEMPLATES) {
  test(`restores the ${slug} template and exports it as PNG and PDF`, async ({ page }) => {
    await downloadInsteadOfShare(page);
    await page.goto('/');
    await expect(page.getByLabel('編み図編集盤面')).toBeVisible();

    // 「バックアップから復元」のファイル入力は出力パネルの外に置いてあるので、パネルを開かずに差し込める。
    await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL(`../../public/templates/${slug}.knit`, import.meta.url)));
    await expect(page.locator('.app-header')).toContainText(`${name}（復元）`, { timeout: 60_000 });
    await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', /20段、20目/);
    // このテストでは復元前にパネルを開いていないので、復元のあとに単純に開く。
    await page.getByRole('button', { name: '出力', exact: true }).click();
    const pngButton = page.getByRole('button', { name: 'PNGを保存', exact: true });
    await expect(pngButton).toBeVisible();

    // 出力パネルに表示した寸法と、実際に保存したPNGの寸法が一致することを確かめる。
    // PNGの寸法は既定では段数・列数と1セルの画素数だけで決まるが、記号の一覧を入れると
    // 使った記号の種類によって高さが変わるため、寸法の同じこと自体はここでは保証しない。
    const sizeText = await page.getByText(/^\d+×\d+px/).textContent();
    const pngDownload = page.waitForEvent('download');
    await pngButton.click();
    const png = await pngDownload;
    expect(await png.failure()).toBeNull();
    const pngBytes = readFileSync((await png.path())!);
    expect(pngBytes.subarray(1, 4).toString()).toBe('PNG');
    const pngSize = { width: pngBytes.readUInt32BE(16), height: pngBytes.readUInt32BE(20) };
    expect(pngSize.width).toBeGreaterThan(0);
    expect(pngSize.height).toBeGreaterThan(0);
    expect(sizeText).toContain(`${pngSize.width}×${pngSize.height}px`);

    const pdfDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PDFを保存', exact: true }).click();
    const pdf = await pdfDownload;
    expect(await pdf.failure()).toBeNull();
    const pdfBytes = readFileSync((await pdf.path())!);
    expect(pdfBytes.subarray(0, 8).toString()).toBe('%PDF-1.7');
    expect(pdfBytes.length).toBeGreaterThan(100);
    // PDFには盤面の画像を描く命令が入っている。`pdfStreams`は壊れたストリームがあると失敗する。
    expect(pdfStreams(pdfBytes).join('\n')).toMatch(/ cm \/S\d+ Do Q/);
  });
}
