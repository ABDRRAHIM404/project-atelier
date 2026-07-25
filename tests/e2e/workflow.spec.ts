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
