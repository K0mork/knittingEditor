import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';

/*
 * iOSの「さらに大きな文字」（Dynamic Type）で、文字が実際に大きくなり、切れずに読めて、操作できることを
 * 実際のWebビルドで確かめる（#389）。iOS版の見た目は、`ios-fold-layout.spec.ts`と同じく
 * `packages/editor-core/styles/base.css`のあとに`ios/Web/src/styles.css`を重ねて作る。
 *
 * iOSのWKWebViewは`:root { font: -apple-system-body }`を端末の文字サイズに解決するが、LinuxやmacOSの
 * Playwrightのブラウザは同じ大きさにしない。そこで、iOSのAX3（`accessibility-extra-large`、約40px）と
 * AX5（`accessibility-extra-extra-extra-large`、約53px）を、ルートの文字サイズを明示して代用する。
 * 同じ確認を、文字拡大を受け入れてよいWeb版（`src/styles.css`だけを読み込むビルド）でも行う。
 */
const IOS_HOST_CSS = ['../../packages/editor-core/styles/base.css', '../../ios/Web/src/styles.css']
  .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

/** iOS版の「使い方」ページ。Webサーバーは配信しないので、ファイルをそのまま読み込んで確かめる。 */
const IOS_GUIDE_HTML = readFileSync(new URL('../../ios/Web/public/guide/index.html', import.meta.url), 'utf8');

/** 端末の文字サイズの代わりに固定するルートの文字サイズ。 */
const TEXT_SCALES = [
  { name: 'AX3', rootFontSize: 40 },
  { name: 'AX5', rootFontSize: 53 },
] as const;

const VIEWPORTS = [
  { name: 'iPhone 17', width: 402, height: 874 },
  { name: 'iPad (A16)', width: 820, height: 1180 },
] as const;

/** `css`が空のときは、ビルドに含まれるWeb版のCSSをそのまま使う。 */
const HOSTS = [
  { name: 'iOS版', css: IOS_HOST_CSS },
  { name: 'Web版', css: '' },
] as const;

/** 長い名前でも全体が読めることを確かめるための編み図名。 */
const LONG_CHART_NAME = 'ブリッジ計測1（一時保存版）とても長い名前の編み図';

/**
 * 文字の切れを調べる対象。タップできるものと、見出し・入力欄のラベル、意味のある文字のまとまり。
 * ヘッダーの「使い方」は`<a>`なので`a`も含める。
 */
const CLIP_SELECTOR = 'button, a, h1, h2, h3, label, .document-name, .stitch-option-name, .stitch-tool-name';

interface ClipScope { label: string; selector: string }

/** レイアウトが落ち着くまで待つ。文字サイズを変えた直後の測定に使う。 */
async function waitForLayout(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/** Dynamic Typeの代わりに、ルートの文字サイズを固定する。あとから足すので、iOS版の`:root`より優先される。 */
async function setRootFontSize(page: Page, rootFontSize: number) {
  await page.addStyleTag({ content: `:root { font-size: ${rootFontSize}px !important; }` });
  await waitForLayout(page);
}

/** 指定したセレクタに一致する可視要素の、計算後の文字サイズ（px）を順に返す。 */
async function fontSizeSamples(page: Page, selectors: string[]): Promise<Record<string, number[]>> {
  return page.evaluate((selectors) => Object.fromEntries(selectors.map((selector) => [
    selector,
    [...document.querySelectorAll(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
      })
      .map((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ])), selectors);
}

/** 拡大後の文字サイズが、既定の1.9倍以上（200%相当）になっていることを確かめる。 */
function expectFontGrowth(label: string, before: Record<string, number[]>, after: Record<string, number[]>) {
  for (const [selector, defaultSizes] of Object.entries(before)) {
    const enlargedSizes = after[selector] ?? [];
    // セレクタが何も指していないと、比較が空振りして通ってしまう。
    expect(defaultSizes.length, `${label}（${selector}）の対象`).toBeGreaterThan(0);
    expect(enlargedSizes.length, `${label}（${selector}）の要素数`).toBe(defaultSizes.length);
    defaultSizes.forEach((defaultSize, index) => {
      expect(defaultSize, `${label}（${selector}）の既定の文字サイズ`).toBeGreaterThan(0);
      expect(enlargedSizes[index], `${label}（${selector}）の文字サイズが既定の1.9倍になる（既定${defaultSize}px）`)
        .toBeGreaterThanOrEqual(defaultSize * 1.9);
    });
  }
}

/** 盤面をドラッグして範囲を選び、選択操作の帯を出す。文字が大きく盤面が小さくても選べるよう、盤面の大きさに対する割合で動かす。 */
async function selectOnCanvas(page: Page) {
  const canvas = page.getByLabel('編み図編集盤面');
  await page.getByRole('button', { name: '範囲', exact: true }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.65, { steps: 4 });
  await page.mouse.up();
  await expect(page.getByRole('toolbar', { name: '選択範囲の操作' })).toBeVisible();
}

/** 編み目記号のパネルを開く。 */
async function openStitchPicker(page: Page) {
  await page.locator('.stitch-tool').click();
  await expect(page.getByRole('dialog', { name: '編み目記号' })).toBeVisible();
}

/** 編み目記号のパネルを閉じる。 */
async function closeStitchPicker(page: Page) {
  await page.getByRole('dialog', { name: '編み目記号' }).getByRole('button', { name: '閉じる', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '編み目記号' })).toHaveCount(0);
}

/**
 * パネルの見出しが1文字ずつ縦に並んでいないことを確かめる。4文字以上の見出しが3行以上に
 * 折り返されていれば、1文字ずつに近い状態とみなす（AX5のiPhoneで起きていた）。
 */
async function expectHeadingReadable(page: Page, selector: string, label: string) {
  const metrics = await page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
    const lineHeight = style.lineHeight === 'normal' ? Number.parseFloat(style.fontSize) * 1.2 : Number.parseFloat(style.lineHeight);
    return {
      lines,
      height: element.getBoundingClientRect().height,
      lineHeight,
      characters: (element.textContent ?? '').replace(/\s+/g, '').length,
    };
  });
  expect(metrics.characters, `${label}の文字数`).toBeGreaterThanOrEqual(4);
  expect(metrics.lines, `${label}が1文字ずつ折り返されない`).toBeLessThan(3);
  expect(metrics.height, `${label}の高さが行の高さの3倍未満`).toBeLessThan(metrics.lineHeight * 3);
}

/** 入力欄の値が横に切れていないことを確かめる。 */
async function expectInputFits(page: Page, label: string) {
  const metrics = await page.getByLabel(label, { exact: true }).evaluate((element) => {
    const input = element as HTMLInputElement;
    return { value: input.value, scrollWidth: input.scrollWidth, clientWidth: input.clientWidth };
  });
  expect(metrics.scrollWidth, `${label}の入力欄に「${metrics.value}」が全部見える`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

/**
 * 文字の切れを集める。`overflow: hidden`・`clip`や`text-overflow: ellipsis`で隠れているものと、
 * 文字が要素の枠の外へ出ているものを、対象の文字を添えて返す。
 */
async function clipProblems(page: Page, scopes: ClipScope[]): Promise<string[]> {
  return page.evaluate(({ scopes, selector }) => {
    const problems: string[] = [];
    const textOf = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && element.getClientRects().length > 0;
    };
    const textRects = (element: Element) => {
      const rects: DOMRect[] = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent?.trim()) continue;
        if (node.parentElement?.closest('.visually-hidden')) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        rects.push(...Array.from(range.getClientRects()));
      }
      return rects;
    };
    for (const scope of scopes) {
      for (const root of document.querySelectorAll(scope.selector)) {
        if (!visible(root)) continue;
        for (const element of root.querySelectorAll(selector)) {
          if (!visible(element)) continue;
          const style = getComputedStyle(element);
          const label = `${scope.label}: 「${textOf(element)}」`;
          const clipsX = style.overflowX === 'hidden' || style.overflowX === 'clip';
          const clipsY = style.overflowY === 'hidden' || style.overflowY === 'clip';
          if (clipsX && element.scrollWidth > element.clientWidth + 1) {
            problems.push(`${label} 横にはみ出しています（scrollWidth ${element.scrollWidth} > clientWidth ${element.clientWidth}）`);
          }
          if (clipsY && element.scrollHeight > element.clientHeight + 1) {
            problems.push(`${label} 縦にはみ出しています（scrollHeight ${element.scrollHeight} > clientHeight ${element.clientHeight}）`);
          }
          if (style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1) {
            problems.push(`${label} 省略記号で切れています`);
          }
          // overflow: visibleでも、文字が枠の外へ出ていれば、隣と重なったり画面からはみ出したりする。
          // 字間（letter-spacing）の分だけ末尾が1pxほど広がることがあるので、2pxまでは許す。
          const bounds = element.getBoundingClientRect();
          if (bounds.width === 0 && bounds.height === 0) continue;
          for (const rect of textRects(element)) {
            if (rect.width === 0 && rect.height === 0) continue;
            if (rect.left < bounds.left - 2 || rect.right > bounds.right + 2 || rect.top < bounds.top - 2 || rect.bottom > bounds.bottom + 2) {
              problems.push(`${label} 文字が枠の外に出ています`);
              break;
            }
          }
        }
      }
    }
    return [...new Set(problems)];
  }, { scopes, selector: CLIP_SELECTOR });
}

/**
 * ヘッダーのボタンが画面の外へ出ず、ほかの要素に覆われていないことを確かめる。
 * 折り返して2段になっても、横スクロールで連れてこられてもよい。
 */
async function expectControlReachable(page: Page, selector: string, label: string) {
  const control = page.locator(selector).first();
  await control.scrollIntoViewIfNeeded();
  const problem = await control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1) return '画面の外にある';
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    if (!hit || !(hit === element || element.contains(hit))) return 'ほかの要素に覆われている';
    return null;
  });
  expect(problem, `${label}を押せる`).toBeNull();
}

/**
 * 編集ツールのすべてのボタンが、画面内にあるか、横スクロールできる親の中にあり、
 * スクロールして連れてこられ、ほかの要素に覆われていないことを確かめる。
 */
async function expectToolbarReachable(page: Page) {
  const buttons = page.locator('.primary-tools button');
  const count = await buttons.count();
  expect(count, '編集ツールのボタン数').toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const name = (await button.getAttribute('aria-label')) ?? (await button.textContent())?.trim() ?? `ボタン${index}`;
    const offscreen = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < 0 || rect.right > window.innerWidth;
    });
    if (offscreen) {
      expect(await button.evaluate((element) => {
        for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && ancestor.scrollWidth > ancestor.clientWidth) return true;
        }
        return false;
      }), `${name}が画面の外にあり、横スクロールできる親もない`).toBe(true);
    }
    await button.scrollIntoViewIfNeeded();
    const problem = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1) {
        return 'scrollIntoViewIfNeededのあとも画面の外にある';
      }
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (!hit || !(hit === element || element.contains(hit))) {
        const cover = hit ? `${hit.tagName.toLowerCase()}${hit.className ? `.${String(hit.className).split(/\s+/).join('.')}` : ''}` : '何もない場所';
        return `中心が${cover}に覆われている`;
      }
      return null;
    });
    expect(problem, `${name}を押せる`).toBeNull();
  }
}

/**
 * 使い方ページの本文が大きくなり、見出しや段落が横にはみ出さないことを確かめる。
 * 呼ぶ前にページを開いておく（既定の文字サイズの測定に使う）。
 */
async function expectGuideReadable(page: Page, rootFontSize: number, label: string) {
  const before = await fontSizeSamples(page, ['main p']);
  await setRootFontSize(page, rootFontSize);
  const after = await fontSizeSamples(page, ['main p']);
  expectFontGrowth(label, before, after);

  const problems = await page.evaluate(() => {
    const problems: string[] = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      problems.push(`ページ全体が横にはみ出しています（scrollWidth ${document.documentElement.scrollWidth} > innerWidth ${window.innerWidth}）`);
    }
    for (const element of document.querySelectorAll('main h1, main h2, main h3, main p, main li, header a, footer a')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.left < -1 || rect.right > window.innerWidth + 1) {
        const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        problems.push(`「${text}」が画面の左右にはみ出しています`);
      }
    }
    return problems;
  });
  expect([...new Set(problems)], `${label}が横にはみ出さない`).toEqual([]);
}

// 画面の大きさはテストの中で指定するので、端末の種類が違うchromium-mobileでは実行しない。
// WebKit（iPhone相当）とChromium（desktop相当）の2つで、文字の拡大と折り返しの違いを代表させる。
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-mobile', 'webkit-mobileとchromium-desktopで代表させる');
});

for (const host of HOSTS) {
  for (const viewport of VIEWPORTS) {
    for (const scale of TEXT_SCALES) {
      test(`${host.name} ${viewport.name} ${scale.name}（ルート${scale.rootFontSize}px）で文字が大きくなり切れない`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto('/');
        await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
        if (host.css !== '') await page.addStyleTag({ content: host.css });
        await waitForLayout(page);

        // 既定の文字サイズ（ブラウザの16px）を先に測り、拡大後の倍率を比べる。
        const defaultToolbarSizes = await fontSizeSamples(page, ['.header-guide', '.header-document', '.stitch-tool-name']);
        await expect(page.locator('.header-guide')).toHaveText('使い方');
        await expect(page.locator('.header-document')).toHaveText('編み図');

        // 選択操作の帯は、選択中だけ現れる。既定の文字サイズを測ったら、いったん選択を外す
        // （帯が残ると画面の下が詰まり、盤面設定や編み図のパネルを開く操作まで覆われかねない）。
        await selectOnCanvas(page);
        const defaultSelectionSizes = await fontSizeSamples(page, ['.selection-actions button']);
        await page.getByRole('toolbar', { name: '選択範囲の操作' }).getByRole('button', { name: 'キャンセル', exact: true }).click();
        await expect(page.getByRole('toolbar', { name: '選択範囲の操作' })).toHaveCount(0);

        await openStitchPicker(page);
        const defaultStitchSizes = await fontSizeSamples(page, ['.stitch-option-name']);
        await closeStitchPicker(page);

        // 端末の文字サイズ（Webではブラウザの文字拡大）に合わせて、ルートを大きくする。
        await setRootFontSize(page, scale.rootFontSize);

        const enlargedToolbarSizes = await fontSizeSamples(page, ['.header-guide', '.header-document', '.stitch-tool-name']);
        expectFontGrowth(`ヘッダーと編集ツール（${host.name}）`, defaultToolbarSizes, enlargedToolbarSizes);

        // ヘッダーと編集ツールの文字が、枠や省略記号で切れていない。
        const clipped = await clipProblems(page, [
          { label: 'ヘッダー', selector: '.app-header' },
          { label: '編集ツール', selector: '.primary-tools' },
        ]);
        expect(clipped, `${host.name} ${viewport.name} ${scale.name}の文字の切れ`).toEqual([]);
        await expectControlReachable(page, '.header-guide', '使い方');
        await expectControlReachable(page, '.header-document', '編み図');

        // 画面の外にある道具も、横スクロールでたどり着けて、ほかの要素に隠れない。
        await expectToolbarReachable(page);

        // 編み目記号のパネル: 名前が大きくなり、見出しが1文字ずつ折り返さない。
        await openStitchPicker(page);
        const enlargedStitchSizes = await fontSizeSamples(page, ['.stitch-option-name']);
        expectFontGrowth('編み目記号の名前', defaultStitchSizes, enlargedStitchSizes);
        await expectHeadingReadable(page, '.stitch-picker-heading h2', '編み目記号');
        expect(await clipProblems(page, [{ label: '編み目記号パネル', selector: '.stitch-picker' }]), '編み目記号パネルの文字の切れ').toEqual([]);
        await closeStitchPicker(page);

        // 盤面設定: 見出しが1文字ずつ折り返さず、段数・列数の値が全部見える。
        await page.getByRole('button', { name: '盤面', exact: true }).click();
        const drawer = page.locator('#app-drawer');
        await expect(drawer).toBeVisible();
        await expectHeadingReadable(page, '#app-drawer .drawer-heading h2', '盤面設定');
        await page.getByLabel('段数', { exact: true }).fill('1000');
        await page.getByLabel('列数', { exact: true }).fill('1000');
        await expect(page.getByLabel('段数', { exact: true })).toHaveValue('1000');
        await expect(page.getByLabel('列数', { exact: true })).toHaveValue('1000');
        await expectInputFits(page, '段数');
        await expectInputFits(page, '列数');
        expect(await clipProblems(page, [{ label: '盤面設定パネル', selector: '#app-drawer' }]), '盤面設定パネルの文字の切れ').toEqual([]);
        await drawer.getByRole('button', { name: '閉じる', exact: true }).click();
        await expect(drawer).toHaveCount(0);

        // 編み図名: 長い名前でも、ヘッダーと一覧の両方で全体が読める（省略記号で切らない）。
        await page.getByRole('button', { name: '編み図', exact: true }).click();
        await expect(drawer).toBeVisible();
        page.once('dialog', (dialog) => dialog.accept(LONG_CHART_NAME));
        await drawer.getByRole('button', { name: '新しい編み図', exact: true }).click();
        // 新しい編み図へ切り替わるときにパネルが閉じるので、名前を確かめてから開き直す。
        await expect(page.locator('.app-document-name')).toContainText(LONG_CHART_NAME);
        await page.getByRole('button', { name: '編み図', exact: true }).click();
        await expect(page.locator('.document-list')).toBeVisible();
        await expect(page.locator('.document-name').filter({ hasText: LONG_CHART_NAME })).toHaveCount(1);
        expect(await clipProblems(page, [
          { label: 'ヘッダーの編み図名', selector: '.app-title' },
          { label: '編み図パネル', selector: '#app-drawer' },
        ]), '長い編み図名が切れていない').toEqual([]);
        await drawer.getByRole('button', { name: '閉じる', exact: true }).click();
        await expect(drawer).toHaveCount(0);

        // 選択操作の帯: 選んだ範囲の操作が、拡大しても切れずに読める（大きさは上の既定値と比べる）。
        await selectOnCanvas(page);
        const enlargedSelectionSizes = await fontSizeSamples(page, ['.selection-actions button']);
        expectFontGrowth('選択範囲の操作', defaultSelectionSizes, enlargedSelectionSizes);
        expect(await clipProblems(page, [{ label: '選択範囲の操作', selector: '.selection-actions' }]), '選択範囲の操作の文字の切れ').toEqual([]);
      });
    }
  }
}

for (const viewport of VIEWPORTS) {
  for (const scale of TEXT_SCALES) {
    test(`Web版の使い方ページ ${viewport.name} ${scale.name}で本文が大きくなり横にはみ出さない`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/guide/');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectGuideReadable(page, scale.rootFontSize, `Web版の使い方（${scale.name}）`);
    });
  }

  test(`iOS版の使い方ページ ${viewport.name} AX3・AX5で本文が大きくなり横にはみ出さない`, async ({ page }) => {
    /*
     * このページは`ios/Web/src/styles.css`を読み込まない独立したHTMLなので、Dynamic Typeに追従するには
     * 自身の`<style>`で`-apple-system-body`を指定する必要がある。Playwrightのブラウザはこの値をiOSと
     * 同じ大きさに解決しないため、指定そのものをここで確かめる（実機の大きさはSimulatorで確認する）。
     */
    expect(IOS_GUIDE_HTML, 'iOS版の使い方ページがDynamic Type（-apple-system-body）に追従する').toContain('-apple-system-body');
    for (const scale of TEXT_SCALES) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.setContent(IOS_GUIDE_HTML);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectGuideReadable(page, scale.rootFontSize, `iOS版の使い方（${scale.name}）`);
    }
  });
}
