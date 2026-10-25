import { expectAutosaved, storedBoards } from './board-helpers';
import { expect, test, type Page } from './fixtures';

async function clickCell(page: Page, row: number, col: number) {
  const canvas = page.getByLabel('編み図編集盤面');
  // 左上のセルを表示領域の中央まで動かし、小さい盤面でも同じ位置から数える。
  await canvas.evaluate(async (element) => {
    element.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: -100_000, deltaY: -100_000 }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const band = 28;
  await canvas.click({ position: {
    x: band + (box!.width - band) / 2 + col * 30,
    y: band + (box!.height - band) / 2 + row * 30,
  } });
}

async function chooseStitch(page: Page, name: string) {
  await page.getByRole('button', { name: '編み目記号を選ぶ', exact: true }).click();
  await page.locator('.stitch-option').filter({ has: page.getByText(name, { exact: true }) }).click();
}

for (const axis of ['column', 'row'] as const) {
  for (const insert of [false, true]) {
    test(`${insert ? 'inserts' : 'removes'} a specified ${axis} through a whole stitch and can erase afterwards`, async ({ page }) => {
      await page.goto('/');
      const canvas = page.getByLabel('編み図編集盤面');
      await expect(canvas).toBeVisible();
      await page.getByRole('button', { name: '盤面', exact: true }).click();
      await page.getByLabel('段数', { exact: true }).fill(axis === 'row' ? '4' : '1');
      await page.getByLabel('列数', { exact: true }).fill(axis === 'column' ? '4' : '1');
      await page.getByRole('button', { name: '変更', exact: true }).click();
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      await chooseStitch(page, axis === 'row' ? 'すべり目' : '右上交差');
      await clickCell(page, 0, 0);
      await chooseStitch(page, '表目');
      await clickCell(page, axis === 'row' ? 2 : 0, axis === 'column' ? 2 : 0);
      await expect(canvas).toHaveAttribute('aria-label', /記号2個/);
      await page.getByRole('button', { name: '盤面', exact: true }).click();
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('3');
      });
      await page.getByRole('button', { name: `${axis === 'row' ? '段' : '列'}を${insert ? '挿入' : '削除'}`, exact: true }).click();
      await expect(canvas).toHaveAttribute('aria-label', insert ? /記号2個/ : /記号1個/);
      await expect(canvas).toHaveAttribute('aria-label', axis === 'row'
        ? new RegExp(`${insert ? 5 : 3}段、1目`) : new RegExp(`1段、${insert ? 5 : 3}目`));
      await page.getByRole('button', { name: '閉じる', exact: true }).click();
      await page.getByRole('button', { name: '消す', exact: true }).click();
      // 削除後は詰めた表目、挿入後は記号の起点以外のセルを消す。
      await clickCell(page, axis === 'row' ? 1 : 0, axis === 'column' ? 1 : 0);
      await expect(canvas).toHaveAttribute('aria-label', insert ? /記号1個/ : /記号0個/);
      if (insert) {
        await clickCell(page, axis === 'row' ? 3 : 0, axis === 'column' ? 3 : 0);
        await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
      }
      // 最後の消去まで保存し終えてから読み込み直す。
      const size = axis === 'row' ? { rows: insert ? 5 : 3, cols: 1 } : { rows: 1, cols: insert ? 5 : 3 };
      await expect.poll(() => storedBoards(page)).toEqual([{ ...size, stitches: 0 }]);
      await expectAutosaved(page);
      await page.reload();
      await expect(canvas).toHaveAttribute('aria-label', /記号0個/);
    });
  }
}
