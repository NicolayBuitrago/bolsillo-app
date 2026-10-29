import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Per package: Turborepo runs the suites in parallel and a shared cache
    // directory at the workspace root is cleared by whichever starts first.
    fsModuleCachePath: './node_modules/.vitest-cache',
  },
});
