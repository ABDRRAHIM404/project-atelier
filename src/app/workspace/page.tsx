import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { resolveWorkflowActor, workflowRole } from '../../platform/workflow';

import { StorefrontShell } from '../_components/storefront-shell';
import { CustomerDashboard } from '../_components/workflow/customer-dashboard';

export const metadata: Metadata = {
  description: 'أنشئ مشروع الأثاث المخصص وتابع عرض السعر والتنفيذ.',
  title: 'مساحة العميل | بيتي بذوقي',
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

type WorkspacePageProps = Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>;

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const parameters = await searchParams;
  const productId = typeof parameters.productId === 'string' ? parameters.productId : undefined;
  const role = await currentWorkflowRole('/workspace');
  if (role === 'MANAGER') redirect('/manager');
  if (!role) {
    const destination = productId
      ? `/workspace?productId=${encodeURIComponent(productId)}`
      : '/workspace';
    redirect(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
  }

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
