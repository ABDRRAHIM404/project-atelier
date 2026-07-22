import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';

import { resolveWorkflowActor, workflowRole } from '../../platform/workflow';

export async function SiteHeader() {
  const translate = await getTranslations('Storefront.navigation');
  const requestHeaders = await headers();
  const request = new Request('http://project-atelier.local/', { headers: requestHeaders });
  const actor = await resolveWorkflowActor(request);
  const role = actor ? workflowRole(actor) : undefined;
  const dashboardHref = role === 'MANAGER' ? '/manager' : '/workspace';
  const dashboardLabel = role === 'MANAGER' ? 'لوحة المدير' : 'مساحتي';

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label={translate('home')}>
          <Image
            alt="بيتي بذوقي"
            className="brand__logo"
            height={72}
            priority
            src="/brand-logo-transparent.png"
            width={124}
          />
        </Link>

        <nav className="primary-navigation" aria-label={translate('label')}>
          <Link href="/catalog">{translate('catalog')}</Link>
          <Link href="/how-it-works">{translate('howItWorks')}</Link>
          <Link href="/custom-design">تصميمك الخاص</Link>
          <Link href={dashboardHref}>{dashboardLabel}</Link>
        </nav>

        <div className="site-header__actions">
          <Show when="signed-in">
            <UserButton
              appearance={{
                elements: {
                  avatarBox: {
                    height: '42px',
                    width: '42px',
                  },
                },
              }}
            />
          </Show>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="button button--secondary button--small site-header__sign-in" type="button">
                <span className="site-header__label--desktop">تسجيل الدخول</span>
                <span className="site-header__label--mobile">دخول</span>
              </button>
            </SignInButton>
          </Show>

          <Link className="button button--small site-header__start" href={dashboardHref}>
            <span className="site-header__label--desktop">{role === 'MANAGER' ? 'لوحة المدير' : 'ابدأ مشروعك'}</span>
            <span className="site-header__label--mobile">{role === 'MANAGER' ? 'الإدارة' : 'ابدأ'}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}