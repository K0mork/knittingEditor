import { expect, test as base } from '@playwright/test';

export { expect };
export type { Page } from '@playwright/test';

/** ChromiumとWebKitがCSPで読み込みや実行を止めたときにコンソールへ出す文言。 */
const CSP_CONSOLE_MESSAGE = /Content[- ]Security[- ]Policy|^CSP violation:/i;

/**
 * すべてのE2Eテストで、Content-Security-Policyの違反を集め、テストの終わりに1件も無いことを確かめる。
 * `securitypolicyviolation`イベントと、ブラウザが出すコンソールのCSPエラーの両方を拾う。
 * 違反を起こすこと自体を確かめるテストは、確かめたあとで`cspViolations`を空にする。
 * WebKitでは`page.screenshot()`のときにPlaywrightが`<style>`を差し込み、それが違反として出る。
 * 画面写真を撮るテストを足すときは、撮る前後で`cspViolations`を分けて確かめる。
 */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [async ({ context }, use) => {
    const violations: string[] = [];
    await context.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        console.error(`CSP violation: ${event.effectiveDirective} blocked ${event.blockedURI || 'inline'} (${event.sourceFile}:${event.lineNumber})`);
      });
    });
    context.on('console', (message) => {
      if (CSP_CONSOLE_MESSAGE.test(message.text())) violations.push(`${message.location().url}: ${message.text()}`);
    });
    await use(violations);
    expect(violations, 'Content-Security-Policyの違反').toEqual([]);
  }, { auto: true }],
});
