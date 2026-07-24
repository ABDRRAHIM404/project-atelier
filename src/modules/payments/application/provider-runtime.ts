import type {
  CheckoutRequest,
  CheckoutSessionResult,
  HostedCheckoutProvider,
  VerifiedGatewayEvent,
} from '../ports/hosted-checkout-provider';

export class UnavailableHostedCheckoutProvider implements HostedCheckoutProvider {
  readonly code = 'unconfigured';
  readonly readiness = Object.freeze({
    available: false,
    reasonCode: 'PROVIDER_NOT_IMPLEMENTED' as const,
  });

  createCheckout(request: CheckoutRequest): Promise<CheckoutSessionResult> {
    void request;
    return Promise.reject(new Error('PAYMENT_PROVIDER_UNAVAILABLE'));
  }

  verifyWebhook(
    request: Readonly<{ headers: Headers; rawBody: string }>,
  ): Promise<VerifiedGatewayEvent> {
    void request;
    return Promise.reject(new Error('PAYMENT_PROVIDER_UNAVAILABLE'));
  }
}

const unavailableProvider = new UnavailableHostedCheckoutProvider();

/**
 * Environment variables alone can never activate Payment. A reviewed real adapter
 * must replace this provider after official documentation and sandbox verification.
 */
export function getHostedCheckoutProvider(): HostedCheckoutProvider {
  return unavailableProvider;
}
