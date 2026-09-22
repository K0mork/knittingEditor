import react from '@vitejs/plugin-react';
import type { ViteUserConfig } from 'vitest/config';

/**
 * Web版とiOS版で共通のVite設定。両ビルドの差分（`modulePreload`、workspaceの参照許可、
 * テスト対象）は各`vite.config.ts`で足す。プラグインは呼び出しごとに作り直す。
 */
export function sharedViteConfig(): ViteUserConfig {
  return {
    base: '/',
    plugins: [react()],
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
