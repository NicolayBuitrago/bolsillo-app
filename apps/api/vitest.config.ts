import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/index.ts'],
      // docs/06-convenciones.md: services >= 80 %.
      thresholds: {
        'src/modules/**/service.ts': { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  },
});
