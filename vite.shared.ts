import react from '@vitejs/plugin-react';
import type { ViteUserConfig } from 'vitest/config';
import { thirdPartyNotices } from './scripts/third-party-notices.mjs';

/**
 * Web版とiOS版で共通のVite設定。両ビルドの差分（`modulePreload`、ソースマップ、workspaceの参照許可、
 * テスト対象）は各`vite.config.ts`で足す。プラグインは呼び出しごとに作り直す。
 */
export function sharedViteConfig(): ViteUserConfig {
  const notices = thirdPartyNotices();
  return {
    base: '/',
    plugins: [react(), notices.plugin],
    worker: {
      plugins: () => [notices.workerPlugin()],
    },
    build: {
      target: ['es2022', 'safari16.4'],
      sourcemap: true,
      chunkSizeWarningLimit: 900,
    },
    test: {
      environment: 'jsdom',
    },
  };
}
