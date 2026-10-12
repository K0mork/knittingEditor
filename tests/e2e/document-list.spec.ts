import { expect, test, type Page } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
});

async function openDocuments(page: Page) {
  await page.getByRole('button', { name: '編み図', exact: true }).click();
  await expect(page.locator('.document-list')).toBeVisible();
}

/** 縮小画像のうち白でない画素の数。画面に入ってから描くので、描き終わるまで待つ側で繰り返し読む。 */
function coloredPixels(page: Page, index = 0) {
  return page.locator('.document-thumbnail').nth(index).evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] === 255 && (data[offset] !== 255 || data[offset + 1] !== 255 || data[offset + 2] !== 255)) count += 1;
    }
    return count;
  });
}

test('shows each chart with a thumbnail and its update time, and refreshes both after an edit', async ({ page }) => {
  await openDocuments(page);
  const item = page.locator('.document').first();
  // 読み上げでは名前・寸法・更新日時の順に読む。
  const open = page.getByRole('button', { name: /^新しい編み図、20段×20目、更新 今日 \d{1,2}:\d{2}$/ });
  await expect(open).toBeVisible();
  await expect(item.locator('time')).toHaveText(/^更新 今日 \d{1,2}:\d{2}$/);
  await expect(item.locator('.document-thumbnail')).toHaveAttribute('aria-hidden', 'true');
  await expect(item.locator('.document-thumbnail')).toHaveJSProperty('width', 20);
  // 枠より小さい縮小画像は、セルの境目をぼかさずに拡大する。
  await expect(item.locator('.document-thumbnail')).toHaveCSS('image-rendering', 'pixelated');
  // 空の盤面は全面が白。
  await expect.poll(() => item.locator('.document-thumbnail').evaluate((canvas: HTMLCanvasElement) =>
    canvas.getContext('2d')!.getImageData(0, 0, 1, 1).data[3])).toBe(255);
  expect(await coloredPixels(page)).toBe(0);
  const before = await item.locator('time').getAttribute('datetime');

  await page.getByRole('button', { name: '閉じる', exact: true }).click();
  const box = (await page.getByLabel('編み図編集盤面').boundingBox())!;
  await page.mouse.move(box.x + 75, box.y + 75);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + 75, { steps: 8 });
  await page.mouse.up();

  // 自動保存が済むと一覧の項目が差し替わり、更新日時と縮小画像が新しくなる。
  await openDocuments(page);
  await expect.poll(async () => Date.parse((await item.locator('time').getAttribute('datetime'))!)).toBeGreaterThan(Date.parse(before!));
  await expect.poll(() => coloredPixels(page)).toBeGreaterThan(0);
});

test('keeps the rename, duplicate and delete buttons easy to press beside a long name', async ({ page }) => {
  await openDocuments(page);
  const longName = 'とても長い名前の編み図をここに付けて一覧の幅に収まるかを確かめる';
  page.once('dialog', (dialog) => dialog.accept(longName));
  await page.getByRole('button', { name: '新しい編み図の名称を変更', exact: true }).click();
  await expect(page.locator('.document-name')).toHaveText(/とても長い名前/);
  await page.getByRole('button', { name: `${longName}を複製`, exact: true }).click();
  await expect(page.locator('.document')).toHaveCount(2);

  const layout = await page.locator('.drawer').evaluate((drawer) => {
    const rect = (element: Element) => element.getBoundingClientRect();
    const drawerRect = rect(drawer);
    return {
      overflow: drawer.scrollWidth - drawer.clientWidth,
      items: [...drawer.querySelectorAll('.document')].map((item) => ({
        item: rect(item).toJSON() as DOMRect,
        thumbnail: rect(item.querySelector('.document-thumbnail-frame')!).toJSON() as DOMRect,
        buttons: [...item.querySelectorAll('.document-actions button')].map((button) => rect(button).toJSON() as DOMRect),
      })),
      drawerRight: drawerRect.right,
    };
  });
  expect(layout.overflow).toBeLessThanOrEqual(0);
  for (const { item, thumbnail, buttons } of layout.items) {
    expect(thumbnail.width).toBeGreaterThanOrEqual(56);
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.width).toBeGreaterThanOrEqual(64);
      expect(button.height).toBeGreaterThanOrEqual(34);
      expect(button.left).toBeGreaterThanOrEqual(item.left);
      expect(button.right).toBeLessThanOrEqual(item.right);
      // 縮小画像と名前の段の下に置き、重ねない。
      expect(button.top).toBeGreaterThanOrEqual(thumbnail.bottom);
    }
    for (let index = 1; index < buttons.length; index++) expect(buttons[index].left).toBeGreaterThan(buttons[index - 1].right);
  }

  // 複製した編み図も縮小画像を持ち、開くと切り替わる。
  const copy = page.getByRole('button', { name: /^とても長い名前.*のコピー、20段×20目、更新 / });
  await copy.click();
  await expect(page.locator('.app-document-name')).toContainText('のコピー');
});

test('finds each chart\'s rename, duplicate and delete buttons by the chart name', async ({ page }) => {
  await openDocuments(page);
  await page.getByRole('button', { name: '新しい編み図を複製', exact: true }).click();
  await expect(page.locator('.document')).toHaveCount(2);

  // 各ボタンの名前は表示の文字と対象の編み図名を含み、ボタンだけを辿っても区別できる。
  for (const name of ['新しい編み図', '新しい編み図のコピー']) {
    const item = page.locator('.document').filter({ has: page.getByRole('button', { name: `${name}を複製`, exact: true }) });
    await expect(item.getByRole('button', { name: `${name}の名称を変更`, exact: true })).toHaveText('名称');
    await expect(item.getByRole('button', { name: `${name}を複製`, exact: true })).toHaveText('複製');
    await expect(item.getByRole('button', { name: `${name}を削除`, exact: true })).toHaveText('削除');
  }

  // 名前を変えると、ボタンの名前も新しい名前になる。
  page.once('dialog', (dialog) => dialog.accept('縄編み'));
  await page.getByRole('button', { name: '新しい編み図のコピーの名称を変更', exact: true }).click();
  await expect(page.getByRole('button', { name: '縄編みの名称を変更', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '縄編みを複製', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '縄編みを削除', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^新しい編み図のコピー/ })).toHaveCount(0);

  // 名前で特定した行だけを削除する。
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toBe('「新しい編み図」を削除しますか？');
    return dialog.accept();
  });
  await page.getByRole('button', { name: '新しい編み図を削除', exact: true }).click();
  // 開いている編み図を消すと残りの編み図へ切り替わり、パネルが閉じる。
  await expect(page.locator('.app-document-name')).toContainText('縄編み');
  await openDocuments(page);
  await expect(page.locator('.document')).toHaveCount(1);
  await expect(page.locator('.document-name')).toHaveText('縄編み');
  await expect(page.getByRole('button', { name: '縄編みを削除', exact: true })).toBeDisabled();
});

test('fits the thumbnail of a large, tall board inside its frame without distorting it', async ({ page }) => {
  await page.getByRole('button', { name: '盤面', exact: true }).click();
  await page.getByLabel('段数').fill('1000');
  await page.getByLabel('列数').fill('250');
  await page.getByRole('button', { name: '変更' }).click();
  await expect(page.getByLabel('編み図編集盤面')).toHaveAttribute('aria-label', /1000段、250目/);
  await page.getByRole('button', { name: '閉じる', exact: true }).click();

  await openDocuments(page);
  await expect(page.getByRole('button', { name: /^新しい編み図、1000段×250目、更新 / })).toBeVisible();
  const thumbnail = page.locator('.document-thumbnail').first();
  // 1000段を96画素以内へまとめ、縦横比を保つ。
  await expect(thumbnail).toHaveJSProperty('height', 91);
  await expect(thumbnail).toHaveJSProperty('width', 23);
  const boxes = await page.locator('.document-thumbnail-frame').first().evaluate((frame) => ({
    frame: frame.getBoundingClientRect().toJSON() as DOMRect,
    canvas: frame.querySelector('canvas')!.getBoundingClientRect().toJSON() as DOMRect,
    fit: getComputedStyle(frame.querySelector('canvas')!).objectFit,
    rendering: getComputedStyle(frame.querySelector('canvas')!).imageRendering,
  }));
  // 枠からはみ出して切り取られず、枠の中で縮めて収める。
  expect(boxes.canvas.height).toBeLessThanOrEqual(boxes.frame.height);
  expect(boxes.canvas.width).toBeLessThanOrEqual(boxes.frame.width);
  expect(boxes.fit).toBe('contain');
  // 枠より大きい縮小画像はpixelatedで縮めると段が抜けて見えるので、滑らかに縮める。
  expect(boxes.rendering).toBe('auto');
});
