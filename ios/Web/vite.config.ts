import { defineConfig } from 'vitest/config';
import { sharedViteConfig } from '../../vite.shared.ts';

const shared = sharedViteConfig();

export default defineConfig({
  ...shared,
  build: {
    ...shared.build,
    // アプリ同梱のローカルbundleではpreloadリンクが効かず、警告だけが増える。
    modulePreload: false,
    // ソースマップはアプリ内で使わず、アプリの容量を増やすだけなので同梱しない。
    sourcemap: false,
  },
  server: {
    fs: { allow: ['..'] },
  },
  test: {
    ...shared.test,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
