export const hostedPaymentMethods = ['MADA', 'VISA', 'MASTERCARD', 'APPLE_PAY'] as const;
export type HostedPaymentMethod = (typeof hostedPaymentMethods)[number];

export type CheckoutRequest = Readonly<{
  amountMinor: number;
  currencyCode: string;
  customerReturnUrl: string;
  merchantReference: string;
  orderId: string;
}>;

export type CheckoutSessionResult = Readonly<{
  checkoutUrl: string;
  expiresAt?: string;
  providerSessionId: string;
}>;

export type VerifiedGatewayEvent = Readonly<{
  amountMinor: number;
  correlationId: string;
  currencyCode: string;
  eventType: string;
  merchantReference: string;
  orderId: string;
  paymentMethod: HostedPaymentMethod | 'UNKNOWN';
  payloadDigest: string;
  providerCode: string;
  providerEventId: string;
  providerOccurredAt?: string;
  providerTransactionId?: string;
  status: 'CANCELLED' | 'EXPIRED' | 'FAILED' | 'SUCCEEDED';
}>;

export interface HostedCheckoutProvider {
  readonly code: string;
  readonly readiness: Readonly<{
    available: boolean;
    reasonCode: 'AVAILABLE' | 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_NOT_IMPLEMENTED';
  }>;

  createCheckout(request: CheckoutRequest): Promise<CheckoutSessionResult>;

  verifyWebhook(
    request: Readonly<{ headers: Headers; rawBody: string }>,
  ): Promise<VerifiedGatewayEvent>;
}
