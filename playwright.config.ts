import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

/**
 * previewサーバーのポート。worktreeごとに作業場所のパスから決め、並行するセッションの
 * サーバーと重ならないようにする。`PLAYWRIGHT_PORT`で上書きできる。
 */
function previewPort(): number {
  const fromEnv = Number(process.env.PLAYWRIGHT_PORT);
  if (Number.isInteger(fromEnv) && fromEnv > 0) return fromEnv;
  const digest = createHash('sha256').update(import.meta.dirname).digest();
  return 4173 + (digest.readUInt16BE(0) % 1000);
}

const port = previewPort();
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 45_000,
  reporter: 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    // 既存のサーバーは再利用しない。別のworktreeや古いビルドのサーバーに対してテストが
    // 通ってしまうため。ポートが使われていれば、Playwrightはテストを始めずに失敗する。
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 14'] } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
