import { defineConfig } from '@playwright/test';

const isContinuousIntegration = process.env.CI === 'true';

export default defineConfig({
  workers: 1,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: isContinuousIntegration,
  fullyParallel: false,
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium-desktop-1280',
      use: { browserName: 'chromium', viewport: { height: 800, width: 1280 } },
    },
    {
      name: 'firefox-desktop-1440',
      use: { browserName: 'firefox', viewport: { height: 900, width: 1440 } },
    },
    {
      name: 'webkit-desktop-1280',
      use: { browserName: 'webkit', viewport: { height: 800, width: 1280 } },
    },
    {
      name: 'chromium-mobile-360',
      use: {
        browserName: 'chromium',
        hasTouch: true,
        isMobile: true,
        viewport: { height: 800, width: 360 },
      },
    },
    {
      name: 'webkit-mobile-390',
      use: {
        browserName: 'webkit',
        hasTouch: true,
        isMobile: true,
        viewport: { height: 844, width: 390 },
      },
    },
    {
      name: 'chromium-mobile-412',
      use: {
        browserName: 'chromium',
        hasTouch: true,
        isMobile: true,
        viewport: { height: 915, width: 412 },
      },
    },
    {
      name: 'chromium-tablet-768',
      use: {
        browserName: 'chromium',
        hasTouch: true,
        viewport: { height: 1024, width: 768 },
      },
    },
    {
      name: 'webkit-tablet-1024',
      use: {
        browserName: 'webkit',
        hasTouch: true,
        viewport: { height: 768, width: 1024 },
      },
    },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }],
  ],
  retries: 0,
  testDir: './tests/e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    colorScheme: 'light',
    locale: 'ar-SA',
    screenshot: 'only-on-failure',
    timezoneId: 'Asia/Riyadh',
  },
  webServer: {
    command: 'npm run start',
    env: {
      APP_ENV: 'test',
    },
    reuseExistingServer: !isContinuousIntegration,
    timeout: 120_000,
    url: 'http://127.0.0.1:3000',
  },
});
