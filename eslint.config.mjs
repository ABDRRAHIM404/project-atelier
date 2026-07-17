import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
  globalIgnores([
    '.next/**',
    '.lighthouseci/**',
    'coverage/**',
    'node_modules/**',
    'playwright-report/**',
    'quality/evidence/runs/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
]);
