import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function switchRole(page: Page, role: 'customer' | 'manager') {
  await page
    .getByRole('button', { exact: true, name: role === 'customer' ? 'العميل' : 'المدير' })
    .click();
  await expect(page).toHaveURL(role === 'customer' ? /\/workspace$/u : /\/manager$/u);
}

test('reaches hosted payment safely and keeps it unavailable until provider wiring', async ({
  page,
}) => {
  await page.request.post('/api/v1/demo-auth', { data: { role: 'customer' } });
  await page.goto('/workspace?productId=11111111-1111-4111-8111-111111111111');

  await expect(
    page.getByRole('heading', { level: 1, name: 'حوّل فكرتك إلى قطعة مصنوعة لك' }),
  ).toBeVisible();
  await page.getByLabel('العرض (سم)').fill('320');
  await page.getByLabel('الخامة').fill('قماش');
  await page.getByLabel('اللون').fill('بيج');
  await page.getByLabel('ملاحظات التخصيص').fill('تنفيذ هادئ لمساحة العائلة');
  await page.getByRole('button', { name: 'إرسال الطلب إلى المدير' }).click();
  await expect(page.getByText('تم إرسال طلب التصميم إلى المدير.')).toBeVisible();

  await switchRole(page, 'manager');
  await expect(page.getByRole('heading', { level: 3, name: 'طلب كنبة سكينة' })).toBeVisible();
  await page.getByRole('button', { name: 'مراجعة وتسعير' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'طلب كنبة سكينة' })).toBeVisible();

  await page.getByLabel('سعر القطعة (ر.س)').fill('4500');
  await page.getByLabel('تكلفة التوصيل (ر.س)').fill('250');
  await page.getByLabel('مدة التنفيذ المتوقعة').fill('من 20 إلى 30 يوم عمل');
  await page.getByRole('button', { name: 'إرسال عرض السعر' }).click();
  await expect(page.getByText('تم إرسال عرض السعر للعميل.')).toBeVisible();

  await switchRole(page, 'customer');
  await expect(page.getByText(/٤٬٧٥٠٫٠٠/u).first()).toBeVisible();
  await page.getByRole('button', { name: 'قبول عرض السعر' }).click();
  await expect(
    page.getByText('تم قبول السعر. أكمل بيانات الاستلام للانتقال إلى الدفع.'),
  ).toBeVisible();

  const orderDialog = page.getByRole('dialog');
  await orderDialog.getByLabel('رقم الهاتف').fill('0500000000');
  await orderDialog.getByLabel('المدينة').fill('الرياض');
  await orderDialog.getByLabel('الحي').fill('النخيل');
  await orderDialog.getByLabel('العنوان الكامل').fill('شارع الملك فهد، مبنى 12');
  await orderDialog
    .getByLabel('رابط الموقع على الخريطة (اختياري)')
    .fill('https://maps.google.com/?q=24.7,46.7');
  await orderDialog.getByLabel('ملاحظات التوصيل (اختياري)').fill('الاتصال قبل الوصول');
  await orderDialog.getByRole('button', { name: 'حفظ تفاصيل الاستلام' }).click();
  await expect(
    page.getByText('تم حفظ تفاصيل الاستلام. سيصبح الدفع متاحاً بعد اكتمال ربط مزود الخدمة.'),
  ).toBeVisible();

  await expect(
    page.getByRole('heading', { level: 4, name: 'الدفع الإلكتروني الآمن' }),
  ).toBeVisible();
  await expect(page.getByText('mada · Visa · Mastercard · Apple Pay')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ادفع الآن' })).toBeDisabled();
  await expect(
    page.getByText('الدفع غير متاح حالياً حتى اكتمال الربط الرسمي مع مزود الخدمة.'),
  ).toBeVisible();
  await expect(page.locator('input[name="receipt"]')).toHaveCount(0);
  await orderDialog.getByRole('button', { name: 'إغلاق' }).click();

  await switchRole(page, 'manager');
  await page.getByRole('tab', { name: /الطلبات/u }).click();
  await page.getByRole('button', { name: 'عرض التفاصيل' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'الدفع الإلكتروني' })).toBeVisible();
  await expect(page.getByText('لم يتم تسجيل عملية دفع إلكتروني موثقة لهذا الطلب.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تأكيد التحويل' })).toHaveCount(0);
  await expect(page.getByText('تقدم الإنتاج')).toHaveCount(0);

  await switchRole(page, 'customer');
  await page.getByRole('tab', { name: /طلباتي/u }).click();
  await page.getByRole('button', { name: 'طلب إلغاء' }).click();
  const cancellationDialog = page.getByRole('dialog', { name: 'إلغاء الطلب' });
  await cancellationDialog.getByLabel('غيّرت رأيي').check();
  await cancellationDialog.getByRole('button', { name: 'تأكيد الإلغاء' }).click();
  await expect(page.getByText('تم إلغاء الطلب وتسجيل السبب.')).toBeVisible();
  await page.getByRole('button', { name: 'الملغاة' }).click();
  await expect(page.getByText('غيّرت رأيي')).toBeVisible();
});

test('keeps the Manager custom-design gallery inside the authorized request view', async ({
  page,
}) => {
  const requestId = '91000000-0000-4000-8000-000000000001';
  const customerId = '92000000-0000-4000-8000-000000000001';
  const requestedAt = '2026-07-25T12:00:00.000Z';
  const requestSummary = {
    customerCity: 'الرياض',
    customerId,
    customerLabel: 'عميلة المعرض',
    customerPhone: '0500000000',
    displayReference: 'REQ-2026-GALLERY',
    id: requestId,
    itemCount: 1,
    projectName: 'خزانة غرفة نوم',
    requestType: 'CUSTOM_DESIGN',
    state: 'SUBMITTED',
    submittedAt: requestedAt,
  };
  const imageBody = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M/wn4GBgYGJAQoAHgQCAQO5nOEAAAAASUVORK5CYII=',
    'base64',
  );
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.route('**/private-designs/*.png', async (route) => {
    await route.fulfill({ body: imageBody, contentType: 'image/png', status: 200 });
  });
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let body: unknown;

    if (path === '/api/v1/manager/requests') body = { requests: [requestSummary] };
    else if (path === `/api/v1/manager/requests/${requestId}`) {
      body = {
        ...requestSummary,
        customerNotes: 'يرجى مطابقة تفاصيل الصور.',
        customDesignDetails: { furnitureType: 'خزانة', quantity: '1' },
        customDesignFiles: [
          {
            displayName: 'الواجهة الأمامية.png',
            mediaType: 'image/png',
            objectKey: `customers/${customerId}/front.png`,
            signedUrl: '/private-designs/front.png',
            size: 2048,
          },
          {
            displayName: 'التقسيم الداخلي.png',
            mediaType: 'image/png',
            objectKey: `customers/${customerId}/inside.png`,
            signedUrl: '/private-designs/inside.png',
            size: 2048,
          },
        ],
        items: [
          {
            configuration: { schemaVersion: 1 },
            customerNotes: '',
            id: '93000000-0000-4000-8000-000000000001',
            productName: 'خزانة غرفة نوم',
            sequence: 1,
          },
        ],
      };
    } else if (path === '/api/v1/orders') body = { orders: [] };
    else if (path === '/api/v1/notifications') body = { notifications: [] };
    else if (path === '/api/v1/manager/catalog/products') body = { products: [] };
    else if (path === '/api/v1/messages') {
      body =
        url.searchParams.get('view') === 'conversations' ? { conversations: [] } : { messages: [] };
    } else {
      await route.continue();
      return;
    }

    await route.fulfill({
      body: JSON.stringify(body),
      contentType: 'application/json',
      status: 200,
    });
  });

  await page.request.post('/api/v1/demo-auth', { data: { role: 'manager' } });
  await page.goto('/manager');
  await page.getByRole('button', { name: 'مراجعة وتسعير' }).click();

  const firstFile = page.getByRole('button', {
    name: 'فتح الواجهة الأمامية.png في معرض ملفات التصميم',
  });
  await expect(firstFile).toBeVisible();
  await expect(page.locator('.custom-design-file-list a')).toHaveCount(0);
  const pageUrl = page.url();

  await firstFile.click();
  const gallery = page.getByRole('dialog', { name: 'الواجهة الأمامية.png' });
  await expect(gallery).toBeVisible();
  await expect(page).toHaveURL(pageUrl);
  await expect(page.context().pages()).toHaveLength(1);
  await expect(gallery.getByText('الملف 1 من 2')).toBeVisible();
  await expect(gallery.getByRole('img', { name: 'الواجهة الأمامية.png' })).toBeVisible();
  await expect(gallery.getByLabel('صور مصغرة لملفات التصميم').getByRole('button')).toHaveCount(2);

  const desktopViewport = page.viewportSize();
  const desktopGalleryBox = await gallery.boundingBox();
  expect(desktopGalleryBox).not.toBeNull();
  expect(desktopGalleryBox?.x).toBe(0);
  expect(desktopGalleryBox?.y).toBe(0);
  expect(desktopGalleryBox?.width).toBe(desktopViewport?.width);
  expect(desktopGalleryBox?.height).toBe(desktopViewport?.height);

  const zoomLevel = gallery.locator('output');
  const image = gallery.getByRole('img', { name: 'الواجهة الأمامية.png' });
  const media = gallery.locator('.custom-design-gallery__media');
  await expect(zoomLevel).toHaveText('100٪');
  await gallery.getByRole('button', { name: 'تكبير الصورة' }).click();
  await expect(zoomLevel).toHaveText('150٪');
  await expect(image).toHaveCSS('transform', /matrix\(1\.5,/u);
  await gallery.getByRole('button', { name: 'تصغير الصورة' }).click();
  await expect(zoomLevel).toHaveText('100٪');

  const mediaBox = await media.boundingBox();
  expect(mediaBox).not.toBeNull();
  if (!mediaBox) throw new Error('The custom-design image viewport was not measurable.');
  await page.mouse.move(mediaBox.x + mediaBox.width / 2, mediaBox.y + mediaBox.height / 2);
  await page.mouse.wheel(0, -300);
  await expect
    .poll(async () => Number((await zoomLevel.textContent())?.replaceAll(/\D/gu, '') ?? 0))
    .toBeGreaterThan(100);

  await gallery.getByRole('button', { name: 'إعادة ضبط الصورة' }).click();
  await gallery.getByRole('button', { name: 'تكبير الصورة' }).click();
  await gallery.getByRole('button', { name: 'تكبير الصورة' }).click();
  const transformBeforeDrag = await image.getAttribute('style');
  await page.mouse.move(mediaBox.x + mediaBox.width / 2, mediaBox.y + mediaBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(mediaBox.x + mediaBox.width / 2, mediaBox.y + mediaBox.height / 2 + 70);
  await page.mouse.up();
  await expect.poll(() => image.getAttribute('style')).not.toBe(transformBeforeDrag);
  await gallery.getByRole('button', { name: 'إعادة ضبط الصورة' }).click();
  await expect(zoomLevel).toHaveText('100٪');

  await gallery.getByRole('button', { name: 'الملف التالي' }).click();
  const activeGallery = page.getByRole('dialog');
  await expect(activeGallery.getByRole('heading', { name: 'التقسيم الداخلي.png' })).toBeVisible();
  await expect(activeGallery.getByText('الملف 2 من 2')).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(activeGallery.getByRole('heading', { name: 'الواجهة الأمامية.png' })).toBeVisible();
  await activeGallery.getByRole('button', { name: 'عرض التقسيم الداخلي.png' }).click();
  await expect(activeGallery.getByRole('heading', { name: 'التقسيم الداخلي.png' })).toBeVisible();

  const accessibilityResults = await new AxeBuilder({ page })
    .include('.custom-design-gallery')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(accessibilityResults.violations).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(activeGallery).toHaveCount(0);
  await expect(firstFile).toBeFocused();
  await expect(page).toHaveURL(pageUrl);

  await page.setViewportSize({ height: 800, width: 360 });
  await firstFile.click();
  const mobileGallery = page.getByRole('dialog');
  await expect(mobileGallery).toBeVisible();
  const mobileGalleryBox = await mobileGallery.boundingBox();
  expect(mobileGalleryBox).not.toBeNull();
  expect(mobileGalleryBox?.x).toBe(0);
  expect(mobileGalleryBox?.y).toBe(0);
  expect(mobileGalleryBox?.width).toBe(360);
  expect(mobileGalleryBox?.height).toBe(800);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);

  const mobileMedia = mobileGallery.locator('.custom-design-gallery__media');
  const mobileZoomLevel = mobileGallery.locator('output');
  await mobileMedia.evaluate((element) => {
    const dispatch = (
      type: string,
      pointerId: number,
      clientX: number,
      clientY: number,
      buttons: number,
    ) => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          buttons,
          cancelable: true,
          clientX,
          clientY,
          isPrimary: pointerId === 1,
          pointerId,
          pointerType: 'touch',
        }),
      );
    };

    dispatch('pointerdown', 1, 120, 400, 1);
    dispatch('pointerdown', 2, 240, 400, 1);
    dispatch('pointermove', 2, 300, 400, 1);
    dispatch('pointerup', 2, 300, 400, 0);
    dispatch('pointerup', 1, 120, 400, 0);
  });
  await expect
    .poll(async () => Number((await mobileZoomLevel.textContent())?.replaceAll(/\D/gu, '') ?? 0))
    .toBeGreaterThan(100);

  const mobileImage = mobileGallery.getByRole('img', { name: 'الواجهة الأمامية.png' });
  const mobileTransformBeforeDrag = await mobileImage.getAttribute('style');
  await mobileMedia.evaluate((element) => {
    const dispatch = (
      type: string,
      pointerId: number,
      clientX: number,
      clientY: number,
      buttons: number,
    ) => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          buttons,
          cancelable: true,
          clientX,
          clientY,
          isPrimary: true,
          pointerId,
          pointerType: 'touch',
        }),
      );
    };

    dispatch('pointerdown', 3, 180, 400, 1);
    dispatch('pointermove', 3, 180, 340, 1);
    dispatch('pointerup', 3, 180, 340, 0);
  });
  await expect.poll(() => mobileImage.getAttribute('style')).not.toBe(mobileTransformBeforeDrag);
  await mobileGallery.getByRole('button', { name: 'إعادة ضبط الصورة' }).click();
  await expect(mobileZoomLevel).toHaveText('100٪');

  await mobileGallery.getByRole('button', { name: 'إغلاق معرض ملفات التصميم' }).click();
  await expect(mobileGallery).toHaveCount(0);
  await expect(firstFile).toBeFocused();
  expect(browserErrors).toEqual([]);
});
