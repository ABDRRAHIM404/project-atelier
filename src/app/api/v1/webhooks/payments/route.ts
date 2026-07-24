import { getHostedCheckoutProvider, PaymentService } from '@/modules/payments';
import { withProviderWebhookActor, workflowProblem } from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const payments = new PaymentService();

export async function POST(request: Request): Promise<Response> {
  try {
    const provider = getHostedCheckoutProvider();
    if (!provider.readiness.available) throw new Error('PAYMENT_PROVIDER_UNAVAILABLE');

    // The raw body is passed untouched to the provider adapter for signature verification.
    // No webhook actor exists until that adapter returns a normalized verified event.
    const event = await provider.verifyWebhook({
      headers: request.headers,
      rawBody: await request.text(),
    });
    const result = await withProviderWebhookActor((transaction) =>
      payments.processGatewayEvent(transaction, event),
    );
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
      status: result.outcome === 'DUPLICATE' ? 200 : 202,
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
