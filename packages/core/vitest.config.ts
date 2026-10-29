import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Per package: Turborepo runs the suites in parallel and a shared cache
    // directory at the workspace root is cleared by whichever starts first.
    fsModuleCachePath: './node_modules/.vitest-cache',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
