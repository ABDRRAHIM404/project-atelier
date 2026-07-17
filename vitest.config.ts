import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      exclude: ['src/**/*.d.ts'],
      include: ['src/**/*.{ts,tsx}'],
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: 'coverage',
    },
    projects: [
      {
        test: {
          environment: 'node',
          include: ['tests/unit/**/*.test.ts'],
          name: 'unit',
          setupFiles: ['tests/setup/test-safety.ts'],
        },
      },
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          include: ['tests/postgres/**/*.test.ts'],
          name: 'postgres',
          setupFiles: ['tests/setup/test-safety.ts'],
          testTimeout: 60_000,
          hookTimeout: 90_000,
        },
      },
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          include: ['tests/integration/**/*.test.ts'],
          name: 'integration',
          setupFiles: ['tests/setup/test-safety.ts'],
        },
      },
    ],
  },
});
