import type { ReactNode } from 'react';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export async function StorefrontShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="site-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}