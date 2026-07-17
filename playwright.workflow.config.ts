import { defineConfig } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim();

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  outputDir: 'test-results/workflow',
  projects: [
    {
      name: 'workflow-chromium',
      use: {
        browserName: 'chromium',
        ...(executablePath
          ? {
              launchOptions: {
                args: ['--disable-crash-reporter', '--disable-crashpad'],
                executablePath,
              },
            }
          : {}),
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
  reporter: [['list']],
  testDir: './tests/e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    colorScheme: 'light',
    locale: 'ar-SA',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Riyadh',
  },
});
