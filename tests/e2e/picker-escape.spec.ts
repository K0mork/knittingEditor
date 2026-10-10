import { expect, test } from './fixtures';

for (const name of ['編み目記号', '記号の色']) {
  test(`${name} closes with Escape after clicking its heading or whitespace and restores focus`, async ({ page }) => {
    await page.goto('/');
    const opener = page.getByRole('button', { name: new RegExp(`^${name}を選ぶ`) });
    const picker = page.getByRole('dialog', { name, exact: true });
    for (const target of ['initial', 'heading', 'whitespace']) {
      // WebKitはクリックしたボタンへフォーカスを移さないので、事前のfocus()なしで復帰先を検証する。
      await opener.click();
      await expect(picker.getByRole('button', { name: '閉じる', exact: true })).toBeFocused();
      if (target === 'heading') await picker.getByRole('heading', { name, exact: true }).click();
      // 見出し帯の上端の余白。角は丸いので、背景に当たらない中央寄りを押す。
      if (target === 'whitespace') await picker.locator('[class$="-picker-heading"]').click({ position: { x: 120, y: 4 } });
      // Issueの再現どおり、クリックでフォーカスがbodyへ移った状態からEscapeを押す。
      if (target !== 'initial') await expect(page.locator('body')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
      await expect(opener).toBeFocused();
    }
  });
}
