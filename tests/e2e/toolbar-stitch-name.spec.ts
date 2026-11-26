import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';

/*
 * 狭い画面の編集ツールで、記号名に2文字分の幅が残ることを確かめる。既定の「表目」は貼付ボタンが出ても
 * 1行のまま、長い名前は2文字以上ずつ折り返す。iOS版の見た目は`larger-text.spec.ts`と同じく、
 * Webビルドに`ios/Web/src/styles.css`を重ねて作る。iPhone Duoの外側は幅466ptで、右にカメラと
 * ステータスバーの列（安全領域、約84pt）がある。
 */
const IOS_HOST_CSS = ['../../packages/editor-core/styles/base.css', '../../ios/Web/src/styles.css']
  .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

const DUO_OUTER = { width: 466, safeRight: 84 };
const LONG_NAME = '裏目右上ねじり目交差';

interface Screen { name: string; width: number; safeRight?: number }

/** ルートの文字サイズと右の安全領域を、あとから足すスタイルで固定する。 */
async function setScreen(page: Page, screen: Screen, rootFontSize?: number) {
  await page.evaluate(({ safeRight, rootFontSize }) => {
    let style = document.getElementById('toolbar-test-screen');
    if (!style) {
      style = document.createElement('style');
      style.id = 'toolbar-test-screen';
      document.head.append(style);
    }
    style.textContent = `${rootFontSize ? `:root { font-size: ${rootFontSize}px !important; }` : ''} :root { --safe-right: ${safeRight}px !important; }`;
  }, { safeRight: screen.safeRight ?? 0, rootFontSize });
  await page.setViewportSize({ width: screen.width, height: 844 });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/** 範囲を選んでコピーし、貼付中をやめる。コピーしたブロックがある間、ツールバーに貼付ボタンが残る。 */
async function copyBlock(page: Page) {
  const canvas = page.getByLabel('編み図編集盤面');
  await page.getByRole('button', { name: '範囲', exact: true }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 81, box.y + 81);
  await page.mouse.down();
  await page.mouse.move(box.x + 111, box.y + 111);
  await page.mouse.up();
  await page.getByRole('button', { name: 'コピー', exact: true }).click();
  await page.getByRole('toolbar', { name: '貼付の操作' }).getByRole('button', { name: 'やめる' }).click();
  await expect(page.getByRole('region', { name: '編集ツール' }).getByRole('button', { name: '貼付', exact: true })).toBeVisible();
}

async function chooseStitch(page: Page, name: string) {
  await page.getByRole('button', { name: '編み目記号を選ぶ', exact: true }).click();
  await page.getByRole('dialog', { name: '編み目記号' }).getByRole('button', { name: new RegExp(`^${name}`) }).click();
  await expect(page.locator('.stitch-tool-name')).toHaveText(name);
}

/** 記号名の行数と幅、記号ボタンと「描く」の高さ、ツールバーのはみ出しを測る。 */
async function measureToolbar(page: Page) {
  return page.getByRole('region', { name: '編集ツール' }).evaluate((toolbar) => {
    const label = toolbar.querySelector<HTMLElement>('.stitch-tool-name')!;
    // 行数は高さから数える。文字の矩形の上端で数えると、かなと漢字で代わりのフォントが違う環境
    // （LinuxのCI）では、同じ行の矩形の上端がずれて2行に数えてしまう。
    const style = getComputedStyle(label);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const lines = Math.round(label.getBoundingClientRect().height / lineHeight);
    const draw = [...toolbar.querySelectorAll('button')].find((button) => button.textContent === '描く')!;
    const last = toolbar.lastElementChild!.getBoundingClientRect();
    return {
      lines,
      labelWidth: label.getBoundingClientRect().width,
      labelHeight: label.getBoundingClientRect().height,
      fontSize: parseFloat(getComputedStyle(label).fontSize),
      stitchHeight: toolbar.querySelector('.stitch-tool')!.getBoundingClientRect().height,
      drawHeight: draw.getBoundingClientRect().height,
      overflows: toolbar.scrollWidth > toolbar.clientWidth,
      lastRight: last.right,
    };
  });
}

/** 「表目」が1行で、記号ボタンがほかのボタンと同じ高さのまま、ツールバーが画面の中に収まる。 */
async function expectDefaultNameOnOneLine(page: Page, screen: Screen, paste: boolean) {
  const sizes = await measureToolbar(page);
  const label = `${screen.name}${paste ? '・貼付あり' : ''}`;
  expect(sizes.lines, `${label}で「表目」が1行`).toBe(1);
  expect(sizes.stitchHeight, `${label}で記号ボタンの高さが変わらない`).toBe(sizes.drawHeight);
  expect(sizes.overflows, `${label}でツールバーがはみ出さない`).toBe(false);
  // 右の安全領域（Duoの外側のカメラの列）にボタンを置かない。
  expect(sizes.lastRight, `${label}で右端のボタンが安全領域の手前にある`).toBeLessThanOrEqual(screen.width - (screen.safeRight ?? 0));
}

/** 長い名前は省略せず、2文字分以上の幅で折り返す（1文字ずつ縦に並ばない）。 */
async function expectLongNameWrapsByTwoOrMore(page: Page, label: string) {
  const sizes = await measureToolbar(page);
  expect(sizes.labelWidth, `${label}で記号名に2文字分の幅がある`).toBeGreaterThanOrEqual(sizes.fontSize * 2 - 0.5);
  const detail = `幅${sizes.labelWidth}px・高さ${sizes.labelHeight}px・文字${sizes.fontSize}px`;
  expect(sizes.lines, `${label}で長い名前が2文字以上ずつ折り返す（${detail}）`).toBeLessThanOrEqual(Math.ceil(LONG_NAME.length / 2));
  await expect(page.locator('.stitch-tool-name')).toHaveText(LONG_NAME);
}

// 360pxはAndroidの最小幅、430pxは詰める境目（429px）のすぐ上。
const WEB_SCREENS: Screen[] = [360, 375, 390, 430, 440].map((width) => ({ name: `${width}px`, width }));

test('Web版の狭い画面で、貼付が出ても「表目」が1行のまま、長い記号名は2文字以上ずつ折り返す', { tag: '@phone' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  for (const screen of WEB_SCREENS) {
    await setScreen(page, screen);
    await expectDefaultNameOnOneLine(page, screen, false);
  }
  await setScreen(page, { name: '390px', width: 390 });
  await copyBlock(page);
  for (const screen of WEB_SCREENS) {
    await setScreen(page, screen);
    await expectDefaultNameOnOneLine(page, screen, true);
  }
  await chooseStitch(page, LONG_NAME);
  for (const screen of WEB_SCREENS) {
    await setScreen(page, screen);
    await expectLongNameWrapsByTwoOrMore(page, `${screen.name}・貼付あり`);
  }
});

// iPhone SE・mini（375）、16e（390）、17（402）、Pro Max（430・440）、iPhone Duoの外側。
const IOS_SCREENS: Screen[] = [
  ...[375, 390, 402, 430, 440].map((width) => ({ name: `${width}pt`, width })),
  { name: 'iPhone Duoの外側', ...DUO_OUTER },
];

test('iOS版の狭い画面とiPhone Duoの外側で、貼付が出ても「表目」が1行のまま、長い記号名は2文字以上ずつ折り返す', { tag: '@webkit-only' }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.addStyleTag({ content: IOS_HOST_CSS });
  // iOSの既定の本文サイズ（Large）は17px。
  for (const screen of IOS_SCREENS) {
    await setScreen(page, screen, 17);
    await expectDefaultNameOnOneLine(page, screen, false);
  }
  // Duoの外側は画面幅が429ptを超えるが、カメラの列を除くと狭いので、余白と間隔を詰める。
  await setScreen(page, IOS_SCREENS.at(-1)!, 17);
  expect(await page.locator('.primary-tools').evaluate((toolbar) => getComputedStyle(toolbar).columnGap)).toBe('3px');

  await setScreen(page, { name: '390pt', width: 390 }, 17);
  await copyBlock(page);
  for (const screen of IOS_SCREENS) {
    await setScreen(page, screen, 17);
    await expectDefaultNameOnOneLine(page, screen, true);
  }

  // 1段階大きい文字（19px）で貼付があると、375ptでは収まらない。名前を割らず、ツールバーを横にスクロールする。
  const se = IOS_SCREENS[0];
  await setScreen(page, se, 19);
  const enlarged = await measureToolbar(page);
  expect(enlarged.lines, '19pxの375pt・貼付ありで「表目」が1行').toBe(1);
  expect(enlarged.overflows, '19pxの375pt・貼付ありでツールバーが横にスクロールする').toBe(true);
  const paste = page.getByRole('region', { name: '編集ツール' }).getByRole('button', { name: '貼付', exact: true });
  await paste.scrollIntoViewIfNeeded();
  await expect(paste).toBeInViewport({ ratio: 1 });

  await setScreen(page, { name: '390pt', width: 390 }, 17);
  await chooseStitch(page, LONG_NAME);
  for (const rootFontSize of [17, 19]) {
    for (const screen of IOS_SCREENS) {
      await setScreen(page, screen, rootFontSize);
      await expectLongNameWrapsByTwoOrMore(page, `${rootFontSize}pxの${screen.name}・貼付あり`);
    }
  }
});
