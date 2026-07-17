import { expect, test, type Page } from '@playwright/test';

async function switchRole(page: Page, role: 'customer' | 'manager') {
  await page.getByRole('button', { name: role === 'customer' ? 'العميل' : 'المدير' }).click();
  await expect(page).toHaveURL(role === 'customer' ? /\/workspace$/u : /\/manager$/u);
}

test('completes the Arabic customer-to-manager order journey', async ({ page }) => {
  await page.request.post('/api/v1/demo-auth', { data: { role: 'customer' } });
  await page.goto('/workspace?productId=11111111-1111-4111-8111-111111111111');

  await expect(
    page.getByRole('heading', { level: 1, name: 'حوّل فكرتك إلى قطعة مصنوعة لك' }),
  ).toBeVisible();
  await page.getByLabel('اسم المشروع').fill('مجلس اختبار كامل');
  await page.getByLabel('ملاحظات عامة').fill('تنفيذ هادئ لمساحة العائلة');
  await page.getByRole('button', { name: 'إنشاء المسودة' }).click();
  await expect(page.getByText('تم إنشاء مسودة المشروع.')).toBeVisible();

  await page.getByLabel('التصميم').selectOption('11111111-1111-4111-8111-111111111111');
  await page.getByLabel('العرض (سم)').fill('320');
  await page.getByLabel('الخامة').fill('قماش');
  await page.getByLabel('اللون').fill('بيج');
  await page.getByRole('button', { name: 'إضافة التصميم' }).click();
  await expect(page.getByText('تمت إضافة التصميم إلى المشروع.')).toBeVisible();

  await page.getByRole('button', { name: 'إرسال المشروع للمراجعة' }).click();
  await expect(page.getByText('أُرسل المشروع إلى المدير للمراجعة.')).toBeVisible();

  await switchRole(page, 'manager');
  await expect(page.getByRole('heading', { level: 3, name: 'مجلس اختبار كامل' })).toBeVisible();
  await page.getByRole('button', { name: 'مراجعة وتسعير' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'مجلس اختبار كامل' })).toBeVisible();

  await page.getByLabel('سعر القطعة (ر.س)').fill('4500');
  await page.getByLabel('تكلفة التوصيل (ر.س)').fill('250');
  await page.getByLabel('مدة التنفيذ المتوقعة').fill('من 20 إلى 30 يوم عمل');
  await page.getByRole('button', { name: 'إرسال عرض السعر' }).click();
  await expect(page.getByText('تم إرسال عرض السعر للعميل.')).toBeVisible();

  await switchRole(page, 'customer');
  await expect(page.getByText(/٤٬٧٥٠٫٠٠/u).first()).toBeVisible();
  await page.getByRole('button', { name: 'اعتماد العرض' }).click();
  await expect(page.getByText('تم اعتماد عرض السعر وإنشاء الطلب.')).toBeVisible();

  await page.getByRole('button', { name: 'عرض التفاصيل' }).click();
  await page.getByLabel('رقم الهاتف').fill('0500000000');
  await page.getByLabel('المدينة').fill('الرياض');
  await page.getByLabel('الحي').fill('النخيل');
  await page.getByLabel('العنوان الكامل').fill('شارع الملك فهد، مبنى 12');
  await page
    .getByLabel('رابط الموقع على الخريطة (اختياري)')
    .fill('https://maps.google.com/?q=24.7,46.7');
  await page.getByLabel('ملاحظات التوصيل (اختياري)').fill('الاتصال قبل الوصول');
  await page.getByRole('button', { name: 'حفظ تفاصيل الاستلام' }).click();
  await expect(
    page.getByText('تم حفظ تفاصيل الاستلام. يمكنك الآن إرسال إثبات التحويل.'),
  ).toBeVisible();

  await page.getByLabel('اسم الملف').fill('bank-transfer.pdf');
  await page.getByLabel('نوع الملف').selectOption('application/pdf');
  await page.getByLabel('مفتاح الملف الخاص').fill('private/payment-proofs/test/bank-transfer.pdf');
  await page.getByLabel('مرجع التحويل').fill('TRX-TEST-001');
  await page.getByRole('button', { name: 'إرسال للمراجعة' }).click();
  await expect(page.getByText('تم إرسال إثبات التحويل للمراجعة اليدوية.')).toBeVisible();

  await switchRole(page, 'manager');
  await page.getByRole('button', { name: 'إدارة الطلب' }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'مراجعة إثبات التحويل' })).toBeVisible();
  await page.getByRole('button', { name: 'تأكيد التحويل' }).click();
  await expect(page.getByText('تم تأكيد التحويل.')).toBeVisible();

  for (const state of ['تجهيز الخامات', 'قيد التنفيذ', 'فحص الجودة', 'جاهز']) {
    await page.getByRole('button', { name: `نقل إلى ${state}` }).click();
    await expect(page.getByText(`تم نقل الإنتاج إلى ${state}.`)).toBeVisible();
  }

  await page.getByLabel('اسم الملف').fill('handoff.jpg');
  await page.getByLabel('نوع الملف').selectOption('image/jpeg');
  await page.getByLabel('مفتاح الملف الخاص').fill('private/handoff/test/handoff.jpg');
  await page.getByRole('button', { name: 'تأكيد التسليم وإكمال الطلب' }).click();
  await expect(page.getByText('تم تسجيل التسليم وإكمال الطلب.')).toBeVisible();

  await switchRole(page, 'customer');
  await expect(page.getByText('مكتمل').first()).toBeVisible();
});
