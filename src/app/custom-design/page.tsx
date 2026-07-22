import type { Metadata } from 'next';

import { StorefrontShell } from '../_components/storefront-shell';
import { CustomDesignForm } from '../_components/workflow/custom-design-form';

export const metadata: Metadata = {
  description: 'ارفع صورة أو مخطط أثاث ليقوم المدير بمراجعته وتسعيره.',
  title: 'أرسل تصميمك الخاص | بيتي بذوقي',
};

export default function CustomDesignPage() {
  return (
    <StorefrontShell>
      <main className="custom-design-page section-shell" id="main-content" tabIndex={-1}>
        <header className="page-hero page-hero--compact">
          <p className="eyebrow">تصميم من فكرتك</p>
          <h1>أرسل تصميمك الخاص</h1>
          <p>ارفع صورًا أو مخططًا، وأضف المقاسات والتفاصيل. سيخبرك المدير إن كان التنفيذ ممكنًا ثم يرسل السعر والمدة.</p>
        </header>
        <CustomDesignForm />
      </main>
    </StorefrontShell>
  );
}
