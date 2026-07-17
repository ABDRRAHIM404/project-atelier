import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const translate = await getTranslations('Storefront.footer');

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <Image
            alt="بيتي بذوقي"
            className="site-footer__logo"
            height={88}
            src="/brand-logo-transparent.png"
            width={152}
          />
          <p>{translate('description')}</p>
        </div>
        <nav aria-label={translate('linksLabel')}>
          <Link href="/catalog">{translate('catalog')}</Link>
          <Link href="/how-it-works">{translate('howItWorks')}</Link>
        </nav>
        <p className="site-footer__note">{translate('note')}</p>
      </div>
    </footer>
  );
}
