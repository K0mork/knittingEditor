import { defineConfig } from 'vitest/config';
import { contentSecurityPolicy } from './scripts/content-security-policy.mjs';
import { sharedViteConfig } from './vite.shared.ts';

const shared = sharedViteConfig();

export default defineConfig({
  ...shared,
  // Web版の配信物だけにCSPのmetaを入れる。iOS版は`ios/docs/WEB_SYNC.md`の差分を参照。
  plugins: [...(shared.plugins ?? []), contentSecurityPolicy()],
  test: {
    ...shared.test,
    include: ['src/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
});
