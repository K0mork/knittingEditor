import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { observeFoldOverlays } from '../../ios/Web/src/nativeFoldLayout';

// iOSホスト専用CSSを、サーバーやネイティブの姿勢に依存しない配置fixtureで検証する。
const css = ['../../packages/editor-core/styles/base.css', '../../ios/Web/src/styles.css']
  .map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
const surfaces = [
  { selector: '.selection-actions', html: '<div class="selection-actions"><button>コピー</button><button>切り取り</button><button>削除</button><button>範囲解除</button></div>' },
  { selector: '.app-dialog', html: '<div class="app-dialog-backdrop"><section class="app-dialog"><h2>編み図の名前</h2><input value="編み図"><div class="app-dialog-actions"><button>キャンセル</button><button>決定</button></div></section></div>' },
  { selector: '.stitch-picker', html: '<div class="stitch-picker-backdrop"><section class="stitch-picker"><h2>編み目記号</h2><button>閉じる</button></section></div>' },
  { selector: '.color-picker', html: '<div class="color-picker-backdrop"><section class="color-picker"><h2>記号の色</h2><button>閉じる</button></section></div>' },
  { selector: '.drawer', html: '<aside class="drawer"><h2>盤面設定</h2><button>閉じる</button></aside>' },
  { selector: '.busy', html: '<div class="busy">読み込み中</div>' },
  { selector: '.toast', html: '<div class="toast">写真に保存できませんでした。<button class="toast-action">やり方を見る</button></div>' },
];

for (const axis of ['vertical', 'horizontal'] as const) {
  test(`iOS interactive overlays avoid the ${axis} fold, including a reduced keyboard viewport`, async ({ page }, testInfo) => {
    for (const height of [669, 260]) {
      await page.setViewportSize({ width: 951, height });
      for (const surface of surfaces) {
        await page.setContent(`<html data-fold="${axis}" style="--fold-start: ${axis === 'vertical' ? 455.5 : 300}px; --fold-end: ${axis === 'vertical' ? 495.5 : 340}px"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${surface.html}</body></html>`);
        await page.addStyleTag({ content: css });
        const stop = await page.evaluateHandle(observeFoldOverlays);
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const box = (await page.locator(surface.selector).boundingBox())!;
        expect(box.width).toBeGreaterThan(0);
        expect(box.height).toBeGreaterThan(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(951);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
        if (axis === 'horizontal') expect(box.y + box.height <= 300 || box.y >= 340).toBe(true);
        if (axis === 'vertical') expect(box.x + box.width <= 455.5 || box.x >= 495.5).toBe(true);
        if (surface.selector === '.app-dialog') {
          for (const button of await page.locator('.app-dialog button').all()) await expect(button).toBeInViewport();
          await page.screenshot({ path: testInfo.outputPath(`dialog-${axis}-${height}.png`) });
        }
        await stop.evaluate(layout => layout.stop());
      }
    }
  });
}


test('iOS fold preserves a wide drawer below the header and flush with the right edge', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 951, height: 669 });
  await page.setContent('<html><body><header class="app-header">使い方 / 編み図</header><aside class="drawer"><h2>盤面</h2><button>閉じる</button></aside></body></html>');
  await page.addStyleTag({ content: css });
  const drawer = page.locator('.drawer');
  const original = await drawer.boundingBox();
  const geometry = () => drawer.evaluate(element => {
    const style = getComputedStyle(element);
    return Object.fromEntries(['top', 'bottom', 'right', 'width', 'max-height', 'transform'].map(key => [key, style.getPropertyValue(key)]));
  });
  const originalStyle = await geometry();
  const stop = await page.evaluateHandle(observeFoldOverlays);
  for (const end of [495.5, 600]) {
    await page.evaluate(end => {
      document.documentElement.dataset.fold = 'vertical';
      document.documentElement.style.setProperty('--fold-start', '455.5px');
      document.documentElement.style.setProperty('--fold-end', `${end}px`);
    }, end);
    await stop.evaluate(layout => layout.update());
    await expect.poll(async () => (await drawer.boundingBox())!.x).toBeGreaterThanOrEqual(end + 12 - 0.01);
    const folded = (await drawer.boundingBox())!;
    expect(folded.y).toBe(original!.y);
    expect(folded.x + folded.width).toBe(original!.x + original!.width);
    if (end === 495.5) {
      expect(folded).toEqual(original);
      expect(await geometry()).toEqual(originalStyle);
      await page.screenshot({ path: testInfo.outputPath('drawer-wide-vertical.png') });
    }
  }
  await stop.evaluate(layout => layout.stop());
});

for (const selector of ['toast', 'busy', 'selection-actions']) {
  test(`iOS ${selector} preserves overlays clear of either side and moves intersections only`, async ({ page }) => {
    await page.setViewportSize({ width: 951, height: 669 });
    for (const axis of ['vertical', 'horizontal']) {
      for (const position of [100, 450, 600]) {
        await page.setContent(`<html data-fold="${axis}" style="--fold-start:455.5px;--fold-end:495.5px"><body><div class="${selector}" style="position:fixed;left:${axis === 'vertical' ? position : 100}px;top:${axis === 'horizontal' ? position : 100}px;bottom:auto;width:100px;height:40px;transform:none;margin:0">操作</div></body></html>`);
        await page.addStyleTag({ content: css });
        const overlay = page.locator(`.${selector}`);
        const original = (await overlay.boundingBox())!;
        const stop = await page.evaluateHandle(observeFoldOverlays);
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        const adjusted = (await overlay.boundingBox())!;
        if (position !== 450) expect(adjusted).toEqual(original);
        else if (axis === 'vertical') expect(adjusted.x).toBeGreaterThanOrEqual(507.5 - 0.01);
        else expect(adjusted.y + adjusted.height).toBeLessThanOrEqual(447.5 + 0.01);
        await stop.evaluate(layout => layout.stop());
      }
    }
  });
}
