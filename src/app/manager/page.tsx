import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { resolveWorkflowActor, workflowRole } from '../../platform/workflow';

import { StorefrontShell } from '../_components/storefront-shell';
import { ManagerDashboard } from '../_components/workflow/manager-dashboard';

export const metadata: Metadata = {
  description: 'إدارة طلبات الأثاث المخصص وعروض السعر والتحويلات والإنتاج.',
  title: 'لوحة المدير | بيتي بذوقي',
};

export const dynamic = 'force-dynamic';

async function currentWorkflowRole(pathname: string) {
  const requestHeaders = await headers();
  const request = new Request(`http://project-atelier.local${pathname}`, {
    headers: requestHeaders,
  });
  const actor = await resolveWorkflowActor(request);
  return actor ? workflowRole(actor) : undefined;
}

export default async function ManagerPage() {
  const role = await currentWorkflowRole('/manager');
  if (role === 'CUSTOMER') redirect('/workspace');
  if (!role) redirect('/sign-in?redirect_url=%2Fmanager');

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
