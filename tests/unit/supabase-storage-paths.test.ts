import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { handoffProofStoragePath, paymentProofStoragePath } from '../../src/lib/supabase-server';

describe('Supabase storage paths', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates payment-proof keys accepted by the payment service', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const orderId = '11111111-1111-4111-8111-111111111111';
    const file = new File(['receipt'], 'bank-transfer.PDF', { type: 'application/pdf' });

    expect(paymentProofStoragePath(orderId, file)).toMatch(
      /^private\/payment-proofs\/11111111-1111-4111-8111-111111111111\/[0-9a-f]{16}\.pdf$/u,
    );
  });

  it('creates handoff-proof keys accepted by the fulfilment service', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const orderId = '11111111-1111-4111-8111-111111111111';
    const file = new File(['proof'], 'delivery.JPG', { type: 'image/jpeg' });

    expect(handoffProofStoragePath(orderId, file)).toMatch(
      /^private\/handoff\/11111111-1111-4111-8111-111111111111\/[0-9a-f]{16}\.jpg$/u,
    );
  });
});
