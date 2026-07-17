import type { Metadata } from 'next';

import { StorefrontShell } from '../_components/storefront-shell';
import { ManagerDashboard } from '../_components/workflow/manager-dashboard';

export const metadata: Metadata = {
  description: 'إدارة طلبات الأثاث المخصص وعروض السعر والتحويلات والإنتاج.',
  title: 'لوحة المدير | بيتي بذوقي',
};

export const dynamic = 'force-dynamic';

export default function ManagerPage() {
  const demoEnabled =
    process.env.ALLOW_DEMO_AUTH === 'true' &&
    process.env.APP_ENV !== 'production' &&
    process.env.APP_ENV !== 'staging';

  return (
    <StorefrontShell>
      <ManagerDashboard demoEnabled={demoEnabled} />
    </StorefrontShell>
  );
}
