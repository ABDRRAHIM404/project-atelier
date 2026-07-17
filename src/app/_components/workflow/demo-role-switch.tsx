'use client';

import { useState } from 'react';

import { apiRequest } from './client-api';

type DemoRoleSwitchProps = Readonly<{ current: 'customer' | 'manager' }>;

export function DemoRoleSwitch({ current }: DemoRoleSwitchProps) {
  const [busy, setBusy] = useState(false);

  async function switchRole(role: 'customer' | 'manager') {
    setBusy(true);
    try {
      await apiRequest('/api/v1/demo-auth', {
        body: JSON.stringify({ role }),
        method: 'POST',
      });
      window.location.assign(role === 'customer' ? '/workspace' : '/manager');
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="demo-role" aria-label="تبديل هوية العرض المحلي">
      <div>
        <strong>وضع العرض المحلي</strong>
        <span>استخدمه لتجربة رحلة العميل والمدير دون ربط Clerk.</span>
      </div>
      <div className="button-row demo-role__actions">
        <button
          className={
            current === 'customer'
              ? 'button button--small'
              : 'button button--small button--secondary'
          }
          disabled={busy || current === 'customer'}
          onClick={() => switchRole('customer')}
          type="button"
        >
          العميل
        </button>
        <button
          className={
            current === 'manager'
              ? 'button button--small'
              : 'button button--small button--secondary'
          }
          disabled={busy || current === 'manager'}
          onClick={() => switchRole('manager')}
          type="button"
        >
          المدير
        </button>
      </div>
    </aside>
  );
}
