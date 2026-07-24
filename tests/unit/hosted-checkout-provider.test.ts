import { describe, expect, it } from 'vitest';

import { UnavailableHostedCheckoutProvider } from '../../src/modules/payments';

describe('hosted checkout provider readiness', () => {
  it('never creates checkout sessions or accepts webhooks before a real adapter exists', async () => {
    const provider = new UnavailableHostedCheckoutProvider();

    expect(provider.readiness).toEqual({
      available: false,
      reasonCode: 'PROVIDER_NOT_IMPLEMENTED',
    });
    await expect(
      provider.createCheckout({
        amountMinor: 10000,
        currencyCode: 'SAR',
        customerReturnUrl: 'https://project-atelier-v1.vercel.app/workspace',
        merchantReference: 'ATL-PAY-test',
        orderId: '10000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toThrow('PAYMENT_PROVIDER_UNAVAILABLE');
    await expect(
      provider.verifyWebhook({ headers: new Headers(), rawBody: '{"status":"paid"}' }),
    ).rejects.toThrow('PAYMENT_PROVIDER_UNAVAILABLE');
  });
});
