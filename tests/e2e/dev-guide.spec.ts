import { createServer, type ViteDevServer } from 'vite';
import { expect, test } from '@playwright/test';

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Dev server has no TCP address');
  origin = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => { await server?.close(); });

test('dev server navigates from editor to guide and reloads the guide', async ({ page }) => {
  await page.goto(origin);
  await expect(page.getByLabel('編み図編集盤面')).toBeVisible();
  await page.getByRole('link', { name: '使い方', exact: true }).click();
  await expect(page).toHaveURL(`${origin}/guide/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ブラウザで棒針編み図を作る方法');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ブラウザで棒針編み図を作る方法');
});
