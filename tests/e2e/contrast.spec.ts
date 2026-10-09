import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * 画面に出ている文字とボタン・入力欄の枠が、地と十分なコントラストを持つことを確かめる（#144）。
 * 文字はWCAGのAA（通常4.5:1、大きい文字3:1）、枠は文字以外の目安の3:1。App Storeのアクセシビリティの
 * 表示で「十分なコントラスト」に答える根拠になる（`ios/docs/APP_STORE_METADATA.md`）。
 */
async function lowContrast(page: Page, label: string): Promise<string[]> {
  return page.evaluate((where) => {
    type Rgba = { r: number; g: number; b: number; a: number };
    const parse = (value: string): Rgba | undefined => {
      const match = value.match(/rgba?\(([^)]+)\)/);
      if (!match) return undefined;
      const parts = match[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    };
    const linear = (channel: number) => { const value = channel / 255; return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4; };
    const luminance = (color: Rgba) => 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
    const over = (top: Rgba, bottom: Rgba): Rgba => ({
      r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1,
    });
    const ratio = (first: Rgba, second: Rgba) => {
      const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (lighter + 0.05) / (darker + 0.05);
    };
    /** 要素の後ろの地の色。グラデーションは明るいほうの端（最後の色）を地とみなし、厳しめに測る。 */
    const backgroundOf = (element: Element | null): Rgba => {
      const layers: Rgba[] = [];
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        const gradient = style.backgroundImage.match(/rgb\([^)]+\)/g);
        if (gradient) { layers.push(parse(gradient[gradient.length - 1])!); break; }
        const color = parse(style.backgroundColor);
        if (color && color.a > 0) { layers.push(color); if (color.a >= 1) break; }
      }
      let base = parse(getComputedStyle(document.documentElement).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
      for (let index = layers.length - 1; index >= 0; index--) base = over(layers[index], base);
      return base;
    };
    const visible = (element: Element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && style.visibility !== 'hidden'
        && !element.closest('.visually-hidden, [aria-hidden="true"], button:disabled');
    };
    const failures: string[] = [];
    const checked = new Set<Element>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      const element = walker.currentNode.parentElement;
      if (!text || !element || checked.has(element) || !visible(element)) continue;
      checked.add(element);
      const style = getComputedStyle(element);
      let opacity = 1;
      for (let current: Element | null = element; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity);
      const background = backgroundOf(element);
      const foreground = parse(style.color)!;
      const value = ratio(over({ ...foreground, a: foreground.a * opacity }, background), background);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66);
      if (value < (large ? 3 : 4.5)) failures.push(`${where}: 文字「${text.slice(0, 16)}」 ${value.toFixed(2)}:1`);
    }
    for (const control of document.querySelectorAll('button, input:not([type="color"]):not([type="range"]):not([type="file"]), select')) {
      if (!visible(control)) continue;
      const style = getComputedStyle(control);
      const border = parse(style.borderTopColor);
      if (!border || parseFloat(style.borderTopWidth) === 0 || border.a === 0) continue;
      const outside = backgroundOf(control.parentElement);
      const value = ratio(over(border, outside), outside);
      const name = control.getAttribute('aria-label') ?? control.textContent?.trim() ?? control.tagName;
      if (value < 3) failures.push(`${where}: 枠「${name.slice(0, 16)}」 ${value.toFixed(2)}:1`);
    }
    return failures;
  }, label);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`keeps text and control borders readable in the ${colorScheme} scheme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
    const failures = await lowContrast(page, '編集画面');

    for (const panel of ['盤面', 'ブロック', '保存']) {
      await page.getByRole('button', { name: panel, exact: true }).click();
      await expect(page.locator('.drawer')).toBeVisible();
      failures.push(...await lowContrast(page, panel));
      await page.getByRole('button', { name: '閉じる' }).click();
    }
    await page.getByRole('button', { name: '編み図', exact: true }).click();
    await expect(page.locator('.drawer')).toBeVisible();
    failures.push(...await lowContrast(page, '編み図'));
    await page.getByRole('button', { name: '閉じる' }).click();

    await page.getByRole('button', { name: '編み目記号を選ぶ' }).click();
    failures.push(...await lowContrast(page, '記号の選択'));
    await page.locator('.stitch-picker').getByRole('button', { name: '閉じる' }).click();
    await page.locator('.color-tool').click();
    failures.push(...await lowContrast(page, '色の選択'));
    await page.locator('.color-picker').getByRole('button', { name: '閉じる' }).click();

    for (const path of ['/guide/', '/support/', '/privacy/']) {
      await page.goto(path);
      failures.push(...await lowContrast(page, path));
    }
    expect(failures).toEqual([]);
  });
}
