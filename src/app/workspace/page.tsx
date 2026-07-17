import type { Metadata } from 'next';

import { StorefrontShell } from '../_components/storefront-shell';
import { CustomerDashboard } from '../_components/workflow/customer-dashboard';

export const metadata: Metadata = {
  description: 'أنشئ مشروع الأثاث المخصص وتابع عرض السعر والتنفيذ.',
  title: 'مساحة العميل | بيتي بذوقي',
};

export const dynamic = 'force-dynamic';

type WorkspacePageProps = Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>;

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const parameters = await searchParams;
  const productId = typeof parameters.productId === 'string' ? parameters.productId : undefined;
  const demoEnabled =
    process.env.ALLOW_DEMO_AUTH === 'true' &&
    process.env.APP_ENV !== 'production' &&
    process.env.APP_ENV !== 'staging';

  return (
    <StorefrontShell>
      <CustomerDashboard demoEnabled={demoEnabled} initialProductId={productId} />
    </StorefrontShell>
  );
}
