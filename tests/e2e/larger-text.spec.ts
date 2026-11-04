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
  // iOSの既定の本文サイズは17px（Large）。ブラウザ任せにせず明示して、iOS実機の既定を再現する。
  { name: 'iOS版', css: IOS_HOST_CSS, defaultRootFontSize: 17 },
  { name: 'Web版', css: '', defaultRootFontSize: 16 },
] as const;

/** 既定サイズの回帰を確かめる画面。320pxはヘッダーだけ、それ以外はパネルも開く。 */
const DEFAULT_VIEWPORTS = [
  { name: 'iPhone SE幅', width: 320, height: 844, headerOnly: true },
  { name: 'iPhone 17', width: 390, height: 844, headerOnly: false },
  { name: 'iPhone 17 Pro Max', width: 430, height: 932, headerOnly: false },
  { name: 'iPad (A16)', width: 820, height: 1180, headerOnly: false },
  { name: 'iPad 横向き', width: 1180, height: 820, headerOnly: false },
] as const;

/** 長い名前でも全体が読めることを確かめるための編み図名。 */
const LONG_CHART_NAME = 'ブリッジ計測1（一時保存版）とても長い名前の編み図';

/**
 * 文字の切れを調べる対象。タップできるものと、見出し・入力欄のラベル、意味のある文字のまとまり。
 * ヘッダーの「使い方」は`<a>`なので`a`も含める。
 */
const CLIP_SELECTOR = 'button, a, h1, h2, h3, label, .document-name, .stitch-option-name, .stitch-tool-name';

interface ClipScope { label: string; selector: string; ignore?: string }

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
          // ヘッダーの編み図名は2行までに抑えてよい。行数と読み上げ文字列は別に確かめる。
          if (scope.ignore && (element.matches(scope.ignore) || element.closest(scope.ignore))) continue;
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
 * 編み図名の方針を確かめる。一覧では折り返して全体を見せ、ヘッダーでは2行までに抑えてよい
 * （全体は一覧で読める）。ヘッダーは省略記号を使わず、読み上げ用の文字列も欠かさない。
 */
async function expectChartNamePolicy(page: Page, name: string, label: string) {
  const listName = page.locator('.document-name').filter({ hasText: name });
  await expect(listName, `${label}の一覧`).toHaveCount(1);
  const listMetrics = await listName.evaluate((element) => ({
    text: element.textContent ?? '',
    textOverflow: getComputedStyle(element).textOverflow,
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(listMetrics.text, `${label}の一覧に全体が出ている`).toContain(name);
  expect(listMetrics.textOverflow, `${label}の一覧が省略記号で切れていない`).not.toBe('ellipsis');
  expect(listMetrics.scrollWidth, `${label}の一覧が横に切れていない`).toBeLessThanOrEqual(listMetrics.clientWidth + 1);
  expect(listMetrics.scrollHeight, `${label}の一覧が縦に切れていない`).toBeLessThanOrEqual(listMetrics.clientHeight + 1);

  // クランプは名前だけの要素に掛ける。保存状態はその外なので、長い名前でも隠れない。
  const headerName = page.locator('.app-document-name-text');
  await expect(headerName, `${label}のヘッダー`).toHaveText(name);
  const headerMetrics = await headerName.evaluate((element) => {
    const style = getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize);
    return {
      text: element.textContent ?? '',
      textOverflow: style.textOverflow,
      height: element.getBoundingClientRect().height,
      lineHeight: style.lineHeight === 'normal' ? fontSize * 1.2 : Number.parseFloat(style.lineHeight),
    };
  });
  // ヘッダーは2行まで。文字を小さくも省略もせず、読み上げ用の文字列は全体のままにする。
  expect(headerMetrics.text, `${label}のヘッダーの読み上げ文字列`).toContain(name);
  expect(headerMetrics.textOverflow, `${label}のヘッダーが省略記号で切れていない`).not.toBe('ellipsis');
  expect(headerMetrics.height, `${label}のヘッダーが2行までに収まる`).toBeLessThanOrEqual(headerMetrics.lineHeight * 2 + 2);
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
 * 操作メニュー（盤面・ブロック・出力・元に戻す・やり直す）が、横スクロールなしで
 * すべて画面内にあり、ほかの要素に覆われていないことを確かめる。
 */
async function expectActionBarReachable(page: Page) {
  const metrics = await page.locator('.action-bar').evaluate((bar) => ({
    scrollWidth: bar.scrollWidth,
    clientWidth: bar.clientWidth,
  }));
  expect(metrics.scrollWidth, '操作メニューが横スクロールしない').toBeLessThanOrEqual(metrics.clientWidth + 1);
  const buttons = page.locator('.action-bar button');
  const count = await buttons.count();
  expect(count, '操作メニューのボタン数').toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const name = (await button.getAttribute('aria-label')) ?? (await button.textContent())?.trim() ?? `ボタン${index}`;
    const problem = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1) {
        return '画面の外にある';
      }
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit && (hit === element || element.contains(hit)) ? null : 'ほかの要素に覆われている';
    });
    expect(problem, `${name}を横スクロールなしで押せる`).toBeNull();
  }
}

/**
 * 選択操作の帯の全ボタンを、横スクロールで連れてきたあとに押せることを確かめる。
 * 帯自体が横スクロールできることも確認し、iOSで見えないスクロールバーだけに頼らない
 * （帯には端のフェードを付けてある）。
 */
async function expectSelectionActionsReachable(page: Page, label: string) {
  const bar = page.locator('.selection-actions');
  const metrics = await bar.evaluate((element) => ({
    scrolling: element.scrollWidth > element.clientWidth + 1,
    overflowX: getComputedStyle(element).overflowX,
    maskImage: getComputedStyle(element).maskImage,
  }));
  if (metrics.scrolling) {
    expect(metrics.overflowX, `${label}の帯が横スクロールできる`).toMatch(/auto|scroll/);
    // iOSのオーバーレイスクロールバーは見えないので、端のフェードで「続きがある」ことを示す。
    expect(metrics.maskImage, `${label}の帯にスクロールできることを示すフェードがある`).not.toBe('none');
  }
  const buttons = bar.locator('button');
  const count = await buttons.count();
  expect(count, `${label}のボタン数`).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const name = (await button.textContent())?.trim() ?? `ボタン${index}`;
    await button.scrollIntoViewIfNeeded();
    const problem = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.left < -1 || rect.right > window.innerWidth + 1 || rect.top < -1 || rect.bottom > window.innerHeight + 1) {
        return 'スクロールしても画面の外にある';
      }
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit && (hit === element || element.contains(hit)) ? null : 'ほかの要素に覆われている';
    });
    expect(problem, `${label}の${name}を押せる`).toBeNull();
  }
}

/** ヘッダーが1行の高さに収まり、操作ボタンが1段目にあることを確かめる。 */
async function expectHeaderSingleRow(page: Page, label: string) {
  const metrics = await page.locator('.app-header').evaluate((header) => {
    const bounds = header.getBoundingClientRect();
    const actions = header.querySelector<HTMLElement>('.header-actions')!.getBoundingClientRect();
    return { height: bounds.height, actionsTop: actions.top - bounds.top, actionsBottom: actions.bottom - bounds.top };
  });
  expect(metrics.height, `${label}のヘッダーが1行の高さに収まる`).toBeLessThan(80);
  expect(metrics.actionsTop, `${label}の操作ボタンが1段目にある`).toBeLessThan(metrics.height / 2);
  expect(metrics.actionsBottom, `${label}の操作ボタンがヘッダー内にある`).toBeLessThanOrEqual(metrics.height);
}

/** 記号パネルの列数を数える。 */
async function expectStitchColumns(page: Page, expected: number, label: string) {
  await openStitchPicker(page);
  const columns = await page.locator('.stitch-grid').first().evaluate((grid) =>
    getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(columns, `${label}の記号の列数`).toBe(expected);
  await closeStitchPicker(page);
}


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
        // 既定の文字サイズを先に測る。iOS版は実機の既定（Large）の17pxにする。
        await setRootFontSize(page, host.defaultRootFontSize);

        // 既定の文字サイズを先に測り、拡大後の倍率を比べる。
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
        await expect(page.locator('.app-shell'), `${host.name} ${viewport.name} ${scale.name}で大きな文字のレイアウトに切り替わる`)
          .toHaveAttribute('data-large-text', '');

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
        // 操作メニューは折り返して、スクロールせずに全部押せる。
        await expectActionBarReachable(page);

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
        // パネルがヘッダーを覆うと「使い方」「編み図」を押せない。iPhone幅では上端がヘッダーの下に来る。
        if (viewport.width < 760) {
          await expectControlReachable(page, '.header-guide', 'パネルを開いている間の使い方');
          await expectControlReachable(page, '.header-document', 'パネルを開いている間の編み図');
        }
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

        // 編み図名: 一覧では折り返して全体を読み、ヘッダーでは2行までに抑える（全体は一覧で読める）。
        await page.getByRole('button', { name: '編み図', exact: true }).click();
        await expect(drawer).toBeVisible();
        page.once('dialog', (dialog) => dialog.accept(LONG_CHART_NAME));
        await drawer.getByRole('button', { name: '新しい編み図', exact: true }).click();
        // 新しい編み図へ切り替わるときにパネルが閉じるので、名前を確かめてから開き直す。
        await expect(page.locator('.app-document-name')).toContainText(LONG_CHART_NAME);
        await page.getByRole('button', { name: '編み図', exact: true }).click();
        await expect(page.locator('.document-list')).toBeVisible();
        await expectChartNamePolicy(page, LONG_CHART_NAME, '長い編み図名');
        // 編み図名（2行までのヘッダーの表示）以外は、ヘッダーも一覧も切れていない。
        expect(await clipProblems(page, [
          { label: 'ヘッダー', selector: '.app-header', ignore: '.app-document-name-text' },
          { label: '編み図パネル', selector: '#app-drawer' },
        ]), '長い編み図名の画面が切れていない').toEqual([]);
        await drawer.getByRole('button', { name: '閉じる', exact: true }).click();
        await expect(drawer).toHaveCount(0);

        /*
         * 長い編み図名＋大きな文字でも、保存状態（保存失敗）がヘッダーの中に見える。
         * IndexedDBの書き込みだけを失敗させ、盤面を編集して保存失敗の表示を出す。
         */
        await page.evaluate(() => {
          const original = IDBObjectStore.prototype.put;
          Object.assign(window, { restoreDocumentPut: () => { IDBObjectStore.prototype.put = original; } });
          IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
            if (this.name === 'documents') throw new DOMException('test quota', 'QuotaExceededError');
            return original.apply(this, args);
          };
        });
        let canvasBox = (await page.getByLabel('編み図編集盤面').boundingBox())!;
        await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
        const status = page.locator('.app-document-status');
        await expect(status, `${host.name} ${scale.name}で保存失敗が見える`).toContainText('保存失敗', { timeout: 10_000 });
        const statusBounds = await status.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const header = element.closest('.app-header')!.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return {
            insideHeader: rect.top >= header.top - 1 && rect.bottom <= header.bottom + 1,
            visible: Boolean(hit && (hit === element || element.contains(hit))),
            text: element.textContent ?? '',
          };
        });
        expect(statusBounds.text, '保存失敗の文字').toContain('保存失敗');
        expect(statusBounds.insideHeader, '保存状態がヘッダーの中に収まる').toBe(true);
        expect(statusBounds.visible, '保存状態がほかの要素に隠れない').toBe(true);
        // 次の保存を成功させ、保存状態の行を消してから盤面の高さを測る。
        await page.evaluate(() => (window as unknown as { restoreDocumentPut: () => void }).restoreDocumentPut());
        canvasBox = (await page.getByLabel('編み図編集盤面').boundingBox())!;
        await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
        await expect(status).toHaveText('', { timeout: 10_000 });

        // 選択操作の帯: 選んだ範囲の操作が、拡大しても切れずに読める（大きさは上の既定値と比べる）。
        await selectOnCanvas(page);
        const enlargedSelectionSizes = await fontSizeSamples(page, ['.selection-actions button']);
        expectFontGrowth('選択範囲の操作', defaultSelectionSizes, enlargedSelectionSizes);
        expect(await clipProblems(page, [{ label: '選択範囲の操作', selector: '.selection-actions' }]), '選択範囲の操作の文字の切れ').toEqual([]);
        // 帯は1行のまま横スクロールし、4つの操作すべてにスクロールで届く。
        await expectSelectionActionsReachable(page, `${host.name} ${scale.name}の選択範囲の操作`);
        // 選択中でも、ヘッダーと操作の段を残して盤面が見える（iPhoneの縦長で確かめる）。
        if (viewport.name === 'iPhone 17') {
          const canvasHeight = (await page.getByLabel('編み図編集盤面').boundingBox())!.height;
          expect(canvasHeight, `${host.name} ${scale.name}で選択中も盤面が見える`).toBeGreaterThanOrEqual(120);
        }
      });
    }
  }
}

/*
 * 既定の文字サイズ（Web 16px / iOS 17px）では、origin/mainと同じ1行レイアウトのままにする。
 * `data-large-text`が付かず、ヘッダー・選択操作・操作メニュー・記号の列が変わらないことを確かめる。
 */
for (const host of HOSTS) {
  for (const viewport of DEFAULT_VIEWPORTS) {
    test(`${host.name} ${viewport.name}（既定${host.defaultRootFontSize}px）で既定の見た目が変わらない`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
      if (host.css !== '') await page.addStyleTag({ content: host.css });
      await setRootFontSize(page, host.defaultRootFontSize);

      await expect(page.locator('.app-shell'), '既定では大きな文字のレイアウトにしない').not.toHaveAttribute('data-large-text', '');
      await expectHeaderSingleRow(page, `${host.name} ${viewport.name}`);
      if (viewport.headerOnly) return;

      // 選択操作と操作メニューは折り返しても横スクロールしない。
      await selectOnCanvas(page);
      const noScroll = await page.evaluate(() => ['.selection-actions', '.action-bar'].map((selector) => {
        const element = document.querySelector<HTMLElement>(selector)!;
        return { selector, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
      }));
      for (const metrics of noScroll) {
        expect(metrics.scrollWidth, `${host.name} ${viewport.name}の${metrics.selector}が横スクロールしない`)
          .toBeLessThanOrEqual(metrics.clientWidth + 1);
      }
      await page.locator('.selection-actions').getByRole('button', { name: 'キャンセル', exact: true }).click();

      // 記号は390pxで3列、iPad幅で5列（originと同じ）。
      await expectStitchColumns(page, viewport.width >= 760 ? 5 : 3, `${host.name} ${viewport.name}`);

      // 編み図パネルの選択バーは、件数と2ボタンが1段に並ぶ。
      await page.getByRole('button', { name: '編み図', exact: true }).click();
      const drawer = page.locator('#app-drawer');
      await expect(drawer).toBeVisible();
      await page.locator('.document-select input').first().click();
      const tops = await page.locator('.document-selection button')
        .evaluateAll((buttons) => buttons.map((button) => Math.round(button.getBoundingClientRect().top)));
      expect(tops.length, '選択バーのボタン数').toBeGreaterThan(0);
      expect(new Set(tops).size, `${host.name} ${viewport.name}の選択バーが1段`).toBe(1);
      await drawer.getByRole('button', { name: '閉じる', exact: true }).click();
    });
  }
}

/*
 * Web版の390×844（iPhone相当）・48px（AX4相当）でも、選択中に盤面が120px以上残る。
 * iOS版の402×874・53pxは上のテストで確かめる。
 */
test('Web版 390x844・48pxで選択中も盤面が120px以上残る', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await setRootFontSize(page, 48);
  await expect(page.locator('.app-shell')).toHaveAttribute('data-large-text', '');
  await expectActionBarReachable(page);
  await selectOnCanvas(page);
  await expectSelectionActionsReachable(page, 'Web版 48pxの選択範囲の操作');
  const canvasHeight = (await page.getByLabel('編み図編集盤面').boundingBox())!.height;
  expect(canvasHeight, 'Web版 390x844・48pxで選択中も盤面が見える').toBeGreaterThanOrEqual(120);
});

/*
 * iPadの横向き（1180×820）。ヘッダーが横1段のままでも、パネルがヘッダーの下から開き、
 * 操作メニューの全ボタンを押せることを確かめる。
 */
for (const host of HOSTS) {
  for (const scale of TEXT_SCALES) {
    test(`${host.name} iPad横向き 1180x820 ${scale.name}でパネルがヘッダーを覆わない`, async ({ page }) => {
      await page.setViewportSize({ width: 1180, height: 820 });
      await page.goto('/');
      await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
      if (host.css !== '') await page.addStyleTag({ content: host.css });
      await setRootFontSize(page, scale.rootFontSize);
      await expect(page.locator('.app-shell')).toHaveAttribute('data-large-text', '');
      await expectControlReachable(page, '.header-guide', 'iPad横向きの使い方');
      await expectControlReachable(page, '.header-document', 'iPad横向きの編み図');
      await expectActionBarReachable(page);

      await page.getByRole('button', { name: '盤面', exact: true }).click();
      const drawer = page.locator('#app-drawer');
      await expect(drawer).toBeVisible();
      await expectControlReachable(page, '.header-guide', 'パネルを開いている間の使い方');
      await expectControlReachable(page, '.header-document', 'パネルを開いている間の編み図');
      await drawer.getByRole('button', { name: '閉じる', exact: true }).click();
    });
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
      // iOS実機の既定本文サイズ（17px）を基準に、AX3/AX5での倍率を測る。
      await setRootFontSize(page, 17);
      await expectGuideReadable(page, scale.rootFontSize, `iOS版の使い方（${scale.name}）`);
    }
  });
}
