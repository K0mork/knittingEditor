import { defineConfig } from 'vitest/config';
import { sharedViteConfig } from './vite.shared.ts';

const shared = sharedViteConfig();

export default defineConfig({
  ...shared,
  test: {
    ...shared.test,
    include: ['src/**/*.test.{ts,tsx}', 'packages/**/*.test.{ts,tsx}'],
  },
});
