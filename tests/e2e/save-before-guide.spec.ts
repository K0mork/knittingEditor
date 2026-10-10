import { expect, test } from './fixtures';

for (const width of [390, 1280]) {
  test(`saves an edit made immediately before opening the guide at width ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const canvas = page.getByLabel('編み図編集盤面', { exact: false });
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + 75, box!.y + 75);
    await expect(canvas).toHaveAttribute('aria-label', /記号1個/);
    await expect(page.locator('.app-document-name')).not.toContainText('保存中');
    // 2つ目のセルを置いた同じタスク内でリンクを押す。400msの自動保存を待たない。
    await canvas.evaluate((element) => {
      element.setPointerCapture = () => {};
      const rect = element.getBoundingClientRect();
      for (const type of ['pointerdown', 'pointerup']) {
        element.dispatchEvent(new PointerEvent(type, {
          bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0,
          clientX: rect.left + 115, clientY: rect.top + 75,
        }));
      }
      (document.querySelector('.header-guide') as HTMLAnchorElement).click();
    });
    await expect(page).toHaveURL(/\/guide\//);
    await page.getByRole('link', { name: '棒針編み図エディタへ戻る' }).click();
    await expect(page.getByLabel('編み図編集盤面', { exact: false })).toHaveAttribute('aria-label', /記号2個/);
  });
}

test('keeps the edited board when saving before the guide fails', async ({ page }) => {
  await page.goto('/');
  const canvas = page.getByLabel('編み図編集盤面', { exact: false });
  await expect(canvas).toBeVisible();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function () { throw new DOMException('test quota', 'QuotaExceededError'); };
  });
  const box = await canvas.boundingBox();
  await page.mouse.click(box!.x + 75, box!.y + 75);
  // 400msの自動保存より前に押す。予約済みの自動保存も失敗するが、使い方の案内は残す。
  await page.locator('.header-guide').click();
  const guideNotice = '編集を保存できなかったため、使い方を開きませんでした。「保存」からバックアップを保存してください。';
  await expect(page.locator('.toast')).toHaveText(guideNotice);
  await page.waitForTimeout(1_000);
  await expect(page.locator('.toast')).toHaveText(guideNotice);
  await expect(page).toHaveURL(/\/$/);
  await expect(canvas).toHaveAttribute('aria-label', /記号1個/);
});
