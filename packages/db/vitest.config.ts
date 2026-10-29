import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Per package: Turborepo runs the suites in parallel and a shared cache
    // directory at the workspace root is cleared by whichever starts first.
    fsModuleCachePath: './node_modules/.vitest-cache',
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
