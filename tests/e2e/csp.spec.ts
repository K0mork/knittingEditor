import { expect, test, type Page } from './fixtures';

const PAGES = ['/', '/guide/', '/support/', '/third-party-notices/'];

async function policyOf(page: Page) {
  const metas = page.locator('meta[http-equiv="Content-Security-Policy"]');
  await expect(metas).toHaveCount(1);
  return (await metas.getAttribute('content'))!;
}

for (const path of PAGES) {
  test(`applies the Content-Security-Policy on ${path} without breaking its styles`, async ({ page }) => {
    await page.goto(path);
    const policy = await policyOf(page);
    for (const directive of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "worker-src 'self'"]) {
      expect(policy).toContain(directive);
    }
    // スクリプトにはインラインと`eval`を許さない。
    const scriptSources = /(?:^|; )script-src ([^;]*)/.exec(policy)![1];
    expect(scriptSources).not.toContain('unsafe-inline');
    expect(policy).not.toContain('unsafe-eval');
    // 使い方などのページは`<style>`要素を、編集画面は外部CSSを使う。どちらも止められていなければ余白が0になる。
    expect(await page.evaluate(() => getComputedStyle(document.body).marginTop)).toBe('0px');
  });
}

test('shows the stitch symbols, whose SVG markup sizes itself with a style attribute, at full size', async ({ page }) => {
  await page.goto('/');
  const symbol = page.locator('.stitch-tool > span:first-child svg');
  await expect(symbol).toBeVisible();
  const [svgBox, spanBox] = await Promise.all([symbol.boundingBox(), page.locator('.stitch-tool > span:first-child').boundingBox()]);
  expect(svgBox!.width).toBeCloseTo(spanBox!.width, 0);
  expect(svgBox!.height).toBeCloseTo(spanBox!.height, 0);
});

test('blocks injected scripts and unknown destinations and reports them to the violation check', async ({ page, cspViolations }) => {
  await page.route('https://example.com/**', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();

  const inlineRan = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__cspInlineRan = true;';
    document.head.append(script);
    return (window as unknown as { __cspInlineRan?: boolean }).__cspInlineRan === true;
  });
  expect(inlineRan).toBe(false);
  const fetched = await page.evaluate(() => fetch('https://example.com/collect', { mode: 'no-cors' }).then(() => true, () => false));
  expect(fetched).toBe(false);

  await expect.poll(() => cspViolations.join('\n')).toMatch(/script-src/);
  await expect.poll(() => cspViolations.join('\n')).toMatch(/connect-src/);
  // 違反を検出できることを確かめたので、このテストでは共通の確認を通す。
  cspViolations.length = 0;
});

test('allows the gtag script and the GA4 collection endpoint', async ({ page }) => {
  // 実際のGoogleへは送らない。読み込みと送信がCSPで止められないことだけを確かめる。
  await page.route('https://www.googletagmanager.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.__gtagLoaded = true;' }));
  await page.route('https://*.google-analytics.com/**', (route) => route.fulfill({ status: 204 }));
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();

  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.googletagmanager.com/gtag/js?id=G-TEST';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('gtag.js was blocked'));
    document.head.append(script);
  }));
  expect(await page.evaluate(() => (window as unknown as { __gtagLoaded?: boolean }).__gtagLoaded)).toBe(true);
  expect(await page.evaluate(() => fetch('https://region1.google-analytics.com/g/collect?v=2', { method: 'POST', mode: 'no-cors', keepalive: true }).then(() => true, () => false))).toBe(true);
});
