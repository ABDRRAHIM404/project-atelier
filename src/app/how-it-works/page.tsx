import type { Metadata } from 'next';
import Link from 'next/link';

import { StorefrontShell } from '../_components/storefront-shell';

export const metadata: Metadata = {
  description: 'من اختيار التصميم أو رفع فكرتك الخاصة حتى التسعير والدفع والتصنيع والتسليم.',
  title: 'طريقة العمل | بيتي بذوقي',
};

const steps = [
  ['01', 'اختر نقطة البداية', 'اختر تصميمًا من الكتالوج لتخصيصه، أو أرسل صورًا ومخططًا لتصميم أثاث خاص بك.'],
  ['02', 'حدد التفاصيل', 'أدخل المقاسات والخامة واللون والكمية والملاحظات، ويمكنك ترك تصميم الكتالوج كما هو.'],
  ['03', 'أرسل الطلب للمراجعة', 'يراجع المدير إمكانية التنفيذ، ويمكنه طلب معلومات إضافية قبل إعداد عرض السعر.'],
  ['04', 'راجع عرض السعر', 'يظهر لك سعر التصنيع وتكلفة التوصيل والمدة المتوقعة وبيانات التحويل البنكي.'],
  ['05', 'اقبل أو ارفض', 'يمكنك قبول العرض، رفضه مع السبب، أو إلغاء الطلب عندما تسمح حالته بذلك.'],
  ['06', 'حوّل المبلغ وأرسل الإيصال', 'استخدم بيانات RIB أو IBAN الظاهرة، ثم ارفع صورة أو ملف PDF لإيصال التحويل.'],
  ['07', 'تابع التصنيع', 'تابع تأكيد الدفع وتجهيز الخامات والتصنيع وفحص الجودة والاستلام أو التوصيل.'],
  ['08', 'احتفظ بكل شيء منظمًا', 'تجد الرسائل والإشعارات والطلبات الملغاة والمكتملة داخل مساحتك وسجلّك.'],
] as const;

export default function HowItWorksPage() {
  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1}>
        <section className="page-hero section-shell" aria-labelledby="process-title">
          <p className="eyebrow">خطوات واضحة من الفكرة إلى التسليم</p>
          <h1 id="process-title">كيف تطلب أثاثك؟</h1>
          <p>مسار واحد منظم، سواء بدأت بتصميم من الكتالوج أو أرسلت تصميمك الخاص.</p>
          <div className="button-row">
            <Link className="button" href="/catalog">تصفح التصاميم</Link>
            <Link className="button button--secondary" href="/custom-design">أرسل تصميمك الخاص</Link>
          </div>
        </section>

        <section className="section section-shell" aria-label="مراحل الطلب">
          <ol className="process-list process-list--extended">
            {steps.map(([number, title, description]) => (
              <li key={number}>
                <span>{number}</span>
                <div><h2>{title}</h2><p>{description}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="section section-shell">
          <div className="journey-callout">
            <div>
              <p className="eyebrow">جاهز للبدء؟</p>
              <h2>اختر تصميمًا أو شاركنا فكرتك</h2>
              <p>ستتابع المراجعة وعرض السعر والدفع والتصنيع من حسابك خطوة بخطوة.</p>
            </div>
            <div className="button-row">
              <Link className="button" href="/catalog">ابدأ من الكتالوج</Link>
              <Link className="button button--secondary" href="/custom-design">تصميم خاص</Link>
            </div>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
