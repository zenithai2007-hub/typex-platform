import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths({ root: '.' })],
  test: {
    include: ['packages/*/test/**/*.test.ts', 'platforms/*/test/**/*.test.ts'],
    testTimeout: 20000,
    env: { TYPEX_AI_FAST: '1' },
  },
});
