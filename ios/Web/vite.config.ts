import { defineConfig } from 'vitest/config';
import { sharedViteConfig } from '../../vite.shared.ts';

const shared = sharedViteConfig();

export default defineConfig({
  ...shared,
  build: {
    ...shared.build,
    // アプリ同梱のローカルbundleではpreloadリンクが効かず、警告だけが増える。
    modulePreload: false,
  },
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    ...shared.test,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
