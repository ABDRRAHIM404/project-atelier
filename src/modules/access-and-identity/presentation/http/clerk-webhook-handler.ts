import { createCorrelationId } from '../../../../platform/observability';
import type { SynchronizeIdentity } from '../../application/synchronize-identity';
import type { ProviderWebhookVerifier } from '../../ports/provider-webhook';
import { identityProblemResponse } from './problem-response';

export class ClerkWebhookHandler {
  constructor(
    private readonly webhooks: ProviderWebhookVerifier,
    private readonly synchronize: SynchronizeIdentity,
  ) {}

  async handle(request: Request): Promise<Response> {
    const correlationId = createCorrelationId();
    const verified = await this.webhooks.verify(request);
    if (!verified.ok) {
      return identityProblemResponse(
        verified.error.code === 'INVALID_SIGNATURE'
          ? 'SESSION_INVALID'
          : verified.error.code === 'MALFORMED_EVENT'
            ? 'MALFORMED_REQUEST'
            : 'IDENTITY_SERVICE_UNAVAILABLE',
        request,
        correlationId,
      );
    }

    if (!verified.value) {
      return Response.json(
        { status: 'ignored' },
        {
          headers: { 'Cache-Control': 'private, no-store', 'X-Correlation-ID': correlationId },
          status: 200,
        },
      );
    }

    const synchronized = await this.synchronize.execute(verified.value, correlationId);
    if (!synchronized.ok) {
      return identityProblemResponse(
        synchronized.error.code === 'PROVIDER_EVENT_CONFLICT'
          ? 'DEPENDENCY_FAILURE'
          : 'IDENTITY_SERVICE_UNAVAILABLE',
        request,
        correlationId,
      );
    }

    return Response.json(
      { status: synchronized.value === 'APPLIED' ? 'accepted' : 'ignored' },
      {
        headers: { 'Cache-Control': 'private, no-store', 'X-Correlation-ID': correlationId },
        status: 200,
      },
    );
  }
}
