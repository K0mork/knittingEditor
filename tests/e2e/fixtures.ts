import { expect, test as base, type Page, type TestInfo } from '@playwright/test';

export { expect };
export type { Page };

/** ChromiumとWebKitがCSPで読み込みや実行を止めたときにコンソールへ出す文言。 */
const CSP_CONSOLE_MESSAGE = /Content[- ]Security[- ]Policy|^CSP violation:/i;

/**
 * すべてのE2Eテストで、Content-Security-Policyの違反を集め、テストの終わりに1件も無いことを確かめる。
 * `securitypolicyviolation`イベントと、ブラウザが出すコンソールのCSPエラーの両方を拾う。
 * 違反を起こすこと自体を確かめるテストは、確かめたあとで`cspViolations`を空にする。
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

/**
 * iPhone・iPadのSafariでは、PNG・PDF・`.knit`をダウンロードせず、確認ダイアログから共有シートへ渡す
 * （`src/platform.ts`の`prefersShareSheet`）。`webkit-mobile`プロジェクトはiPhone 14として動くので、
 * 共有APIがあればこの導線になる。共有シートの導線は`stubShareSheet`を使うテストで確かめる。
 */
const SHARE_SHEET_PROJECT = 'webkit-mobile';

/**
 * 共有APIを外し、どのプロジェクトでも書き出しを実際のダウンロードとして受け取れるようにする。
 * 初期化スクリプトなので、このあと読み込む（または読み込み直す）ページから効く。
 */
export async function downloadInsteadOfShare(page: Page) {
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true }));
}

/** 共有シートの模擬が記録したこと。`files`は共有1回ごとの`[ファイル名, MIMEタイプ]`。 */
interface ShareSheetState { files: Array<Array<[string, string]>>; cancelNext: boolean }
type ShareSheetWindow = Window & { shareSheet: ShareSheetState };

/**
 * iPhone Safariの共有シートを模擬する。Playwrightのブラウザには共有APIが無いので差し替える。
 * 共有シートを使うのはiPhone相当のプロジェクトだけなので、ほかのプロジェクトではテストを飛ばす。
 * 初期化スクリプトなので、このあと読み込む（または読み込み直す）ページから効く。
 */
export async function stubShareSheet(page: Page, testInfo: TestInfo) {
  test.skip(testInfo.project.name !== SHARE_SHEET_PROJECT, 'iPhone Safariだけの保存導線');
  await page.addInitScript(() => {
    const state: ShareSheetState = { files: [], cancelNext: false };
    Object.assign(window, { shareSheet: state });
    Object.defineProperty(navigator, 'canShare', { value: (data: ShareData) => (data.files?.length ?? 0) > 0, configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        if (state.cancelNext) {
          state.cancelNext = false;
          throw new DOMException('cancelled', 'AbortError');
        }
        state.files.push((data.files ?? []).map((file) => [file.name, file.type]));
      },
    });
  });
  return {
    /** 共有1回ごとに渡したファイルの`[ファイル名, MIMEタイプ]`。 */
    sharedFiles: () => page.evaluate(() => (window as unknown as ShareSheetWindow).shareSheet.files),
    /** これまでに共有したファイル名を順に並べたもの。 */
    sharedNames: () => page.evaluate(() => (window as unknown as ShareSheetWindow).shareSheet.files.flat().map(([name]) => name)),
    /** 次の共有を、利用者が共有シートを閉じたときと同じ`AbortError`で終わらせる。 */
    cancelNext: () => page.evaluate(() => { (window as unknown as ShareSheetWindow).shareSheet.cancelNext = true; }),
  };
}
