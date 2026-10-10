import { expect, test } from './fixtures';

for (const name of ['編み目記号', '記号の色']) {
  test(`${name} closes with Escape after clicking its heading or whitespace and restores focus`, async ({ page }) => {
    await page.goto('/');
    const opener = page.getByRole('button', { name: new RegExp(`^${name}を選ぶ`) });
    const picker = page.getByRole('dialog', { name, exact: true });
    for (const target of ['initial', 'heading', 'whitespace']) {
      // WebKitでもクリック前のフォーカスを明示し、復帰先を検証する。
      await opener.focus();
      await opener.click();
      await expect(picker.getByRole('button', { name: '閉じる', exact: true })).toBeFocused();
      if (target === 'heading') await picker.getByRole('heading', { name, exact: true }).click();
      if (target === 'whitespace') await picker.click({ position: { x: 4, y: 4 } });
      if (target !== 'initial') {
        // ブラウザーがフォーカスを残す場合も、Issueのbodyフォーカス状態を検証する。
        await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
        await expect(page.locator('body')).toBeFocused();
      }
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
      await expect(opener).toBeFocused();
    }
  });
}
