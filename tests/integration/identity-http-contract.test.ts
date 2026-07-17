import { describe, expect, it, vi } from 'vitest';

import { SynchronizeIdentity } from '../../src/modules/access-and-identity';
import type {
  IdentitySynchronizationEvent,
  ProviderEventId,
  ProviderSubject,
} from '../../src/modules/access-and-identity/domain/identity';
import { ClerkWebhookHandler } from '../../src/modules/access-and-identity/presentation/http/clerk-webhook-handler';
import { err, ok, parseUtcInstant } from '../../src/shared/kernel';

function identityEvent(): IdentitySynchronizationEvent {
  const occurredAt = parseUtcInstant('2026-07-16T12:00:00.000Z');
  if (!occurredAt.ok) throw new Error('Test instant is invalid.');
  return Object.freeze({
    eventId: 'evt_contract' as ProviderEventId,
    eventType: 'USER_UPDATED',
    payloadDigest: 'a'.repeat(64),
    provider: 'clerk',
    providerOccurredAt: occurredAt.value,
    subject: 'user_contract' as ProviderSubject,
    user: Object.freeze({
      accessRestricted: false,
      verifiedPrimaryEmail: 'contract@example.invalid',
    }),
  });
}

describe('POST /api/v1/webhooks/clerk contract', () => {
  it.each([
    ['APPLIED', 'accepted'],
    ['DUPLICATE', 'ignored'],
    ['IGNORED_STALE', 'ignored'],
  ] as const)('returns a stable private response for %s', async (synchronizationResult, status) => {
    const synchronize = vi.fn(async () => ok(synchronizationResult));
    const handler = new ClerkWebhookHandler(
      { verify: vi.fn(async () => ok(identityEvent())) },
      new SynchronizeIdentity({ synchronize }),
    );
    const response = await handler.handle(
      new Request('https://atelier.invalid/api/v1/webhooks/clerk', {
        body: '{}',
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-correlation-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(await response.json()).toEqual({ status });
    expect(synchronize).toHaveBeenCalledTimes(1);
  });

  it('does not invoke synchronization after a forged signature', async () => {
    const synchronize = vi.fn(async () => ok('APPLIED' as const));
    const handler = new ClerkWebhookHandler(
      { verify: vi.fn(async () => err({ code: 'INVALID_SIGNATURE' as const })) },
      new SynchronizeIdentity({ synchronize }),
    );
    const response = await handler.handle(
      new Request('https://atelier.invalid/api/v1/webhooks/clerk', {
        body: '{}',
        method: 'POST',
      }),
    );
    const problem = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(problem).toMatchObject({ code: 'SESSION_INVALID', retryable: false, status: 401 });
    expect(synchronize).not.toHaveBeenCalled();
  });

  it('acknowledges unrelated signed Clerk events without business effects', async () => {
    const synchronize = vi.fn(async () => ok('APPLIED' as const));
    const handler = new ClerkWebhookHandler(
      { verify: vi.fn(async () => ok(null)) },
      new SynchronizeIdentity({ synchronize }),
    );
    const response = await handler.handle(
      new Request('https://atelier.invalid/api/v1/webhooks/clerk', {
        body: '{}',
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ignored' });
    expect(synchronize).not.toHaveBeenCalled();
  });
});
