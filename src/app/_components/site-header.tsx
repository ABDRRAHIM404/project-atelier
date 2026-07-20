import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function SiteHeader() {
  const translate = await getTranslations('Storefront.navigation');

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
          <Link href="/workspace">مساحتي</Link>
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

          <Link className="button button--small site-header__start" href="/workspace">
            <span className="site-header__label--desktop">ابدأ مشروعك</span>
            <span className="site-header__label--mobile">ابدأ</span>
          </Link>
        </div>
      </div>
    </header>
  );
}