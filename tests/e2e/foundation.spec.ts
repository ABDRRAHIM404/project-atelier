import AxeBuilder from '@axe-core/playwright';
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

type BrowserFailures = Readonly<{
  consoleErrors: string[];
  pageErrors: string[];
}>;

function captureUnexpectedBrowserFailures(page: Page): BrowserFailures {
  const failures: BrowserFailures = {
    consoleErrors: [],
    pageErrors: [],
  };

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') failures.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error: Error) => {
    failures.pageErrors.push(error.message);
  });

  return failures;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectAccessiblePage(page: Page) {
  const accessibilityResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(accessibilityResults.violations).toEqual([]);
}

test('renders the Arabic RTL showroom without browser failures', async ({ page }, testInfo) => {
  const failures = captureUnexpectedBrowserFailures(page);
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('بيتي بذوقي');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('heading', { level: 1, name: 'أثاث يليق ببيتك، ويُصنع على ذوقك.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'استكشف التصاميم' }).first()).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'نقطة بداية لمشروعك القادم' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  if (testInfo.project.name === 'chromium-desktop-1280') {
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'انتقل إلى المحتوى الرئيسي' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
    await expectAccessiblePage(page);
  }

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
});

test('completes the visitor catalog and product-detail journey', async ({ page }, testInfo) => {
  const failures = captureUnexpectedBrowserFailures(page);
  await page.goto('/catalog');

  await expect(
    page.getByRole('heading', { level: 1, name: 'ابدأ من تصميم، ثم اجعله يناسب بيتك.' }),
  ).toBeVisible();
  await expect(page.getByText('6 تصاميم')).toBeVisible();

  await page.getByLabel('ابحث في التصاميم').fill('كنبة');
  await page.getByRole('button', { name: 'بحث' }).click();
  await expect(page).toHaveURL(/q=%D9%83%D9%86%D8%A8%D8%A9/u);
  await expect(page.getByRole('heading', { level: 3, name: 'كنبة سكينة' })).toBeVisible();
  await expect(page.getByText('تصميم واحد')).toBeVisible();

  await page.getByRole('link', { name: 'كنبة سكينة' }).first().click();
  await expect(page).toHaveURL('/catalog/11111111-1111-4111-8111-111111111111');
  await expect(page.getByRole('heading', { level: 1, name: 'كنبة سكينة' })).toBeVisible();
  await expect(page.getByText('يُنفذ حسب الطلب').first()).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 2, name: 'التفاصيل النهائية تُبنى حول مساحتك.' }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  if (testInfo.project.name === 'chromium-desktop-1280') await expectAccessiblePage(page);

  expect(failures.consoleErrors).toEqual([]);
  expect(failures.pageErrors).toEqual([]);
});
