import { createHash } from 'node:crypto';

import { verifyWebhook, type WebhookEvent } from '@clerk/backend/webhooks';
import { z } from 'zod';

import { err, ok, utcInstantFromDate, type Result } from '../../../../shared/kernel';
import type {
  IdentitySynchronizationEvent,
  ProviderEventId,
  ProviderSubject,
} from '../../domain/identity';
import type { ProviderWebhookFailure, ProviderWebhookVerifier } from '../../ports/provider-webhook';

type ClerkWebhookVerification = (request: Request, signingSecret: string) => Promise<WebhookEvent>;
const emailAddressSchema = z.email().max(320);

function providerInstant(event: WebhookEvent, request: Request) {
  const data = event.data as Readonly<{ created_at?: number; updated_at?: number }>;
  const milliseconds = data.updated_at ?? data.created_at;
  if (typeof milliseconds === 'number') return utcInstantFromDate(new Date(milliseconds));

  const timestamp = request.headers.get('webhook-timestamp');
  return timestamp && /^\d+$/u.test(timestamp)
    ? utcInstantFromDate(new Date(Number(timestamp) * 1000))
    : undefined;
}

function primaryVerifiedEmail(
  event: Extract<WebhookEvent, { type: 'user.created' | 'user.updated' }>,
) {
  const primary = event.data.email_addresses.find(
    (email) => email.id === event.data.primary_email_address_id,
  );
  return primary?.verification?.status === 'verified' &&
    emailAddressSchema.safeParse(primary.email_address).success
    ? primary.email_address
    : null;
}

export class ClerkWebhookVerifier implements ProviderWebhookVerifier {
  constructor(
    private readonly signingSecret: string,
    private readonly verifyClerkWebhook: ClerkWebhookVerification = (request, secret) =>
      verifyWebhook(request, { signingSecret: secret }),
  ) {
    if (!signingSecret) throw new Error('Clerk webhook signing configuration is incomplete.');
  }

  async verify(
    request: Request,
  ): Promise<Result<IdentitySynchronizationEvent | null, ProviderWebhookFailure>> {
    const eventId = request.headers.get('webhook-id');
    if (!eventId || eventId.length > 255 || /[\u0000-\u001f\u007f]/u.test(eventId)) {
      return err({ code: 'MALFORMED_EVENT' });
    }

    const rawBody = await request
      .clone()
      .arrayBuffer()
      .catch(() => null);
    if (!rawBody) return err({ code: 'MALFORMED_EVENT' });

    let event: WebhookEvent;
    try {
      event = await this.verifyClerkWebhook(request, this.signingSecret);
    } catch {
      return err({ code: 'INVALID_SIGNATURE' });
    }

    if (
      event.type !== 'user.created' &&
      event.type !== 'user.updated' &&
      event.type !== 'user.deleted'
    ) {
      return ok(null);
    }

    const subject = event.data.id;
    if (!subject || subject.length > 255 || /[\u0000-\u001f\u007f]/u.test(subject)) {
      return err({ code: 'MALFORMED_EVENT' });
    }

    const occurredAt = providerInstant(event, request);
    if (occurredAt && !occurredAt.ok) return err({ code: 'MALFORMED_EVENT' });

    const user =
      event.type === 'user.deleted'
        ? null
        : Object.freeze({
            accessRestricted: event.data.banned || event.data.locked,
            verifiedPrimaryEmail: primaryVerifiedEmail(event),
          });

    return ok(
      Object.freeze({
        eventId: eventId as ProviderEventId,
        eventType:
          event.type === 'user.created'
            ? 'USER_CREATED'
            : event.type === 'user.updated'
              ? 'USER_UPDATED'
              : 'USER_DELETED',
        payloadDigest: createHash('sha256').update(Buffer.from(rawBody)).digest('hex'),
        provider: 'clerk',
        providerOccurredAt: occurredAt?.ok ? occurredAt.value : null,
        subject: subject as ProviderSubject,
        user,
      }),
    );
  }
}
