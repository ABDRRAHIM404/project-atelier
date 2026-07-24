import { randomUUID } from 'node:crypto';

import { getHostedCheckoutProvider, PaymentService } from '@/modules/payments';
import { withWorkflowActor, workflowProblem } from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const payments = new PaymentService();

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  const provider = getHostedCheckoutProvider();
  let attemptId: string | undefined;
  try {
    if (!provider.readiness.available) throw new Error('PAYMENT_PROVIDER_UNAVAILABLE');
    const { orderId } = await context.params;
    const idempotencyKey = request.headers.get('idempotency-key')?.trim() || randomUUID();
    const prepared = await withWorkflowActor(request, (transaction) =>
      payments.prepareCheckout(transaction, {
        idempotencyKey,
        orderId,
        providerCode: provider.code,
      }),
    );
    attemptId = prepared.attemptId;
    if (prepared.replay) {
      return Response.json(prepared.replay, {
        headers: { 'Cache-Control': 'private, no-store' },
        status: 200,
      });
    }

    const session = await provider.createCheckout({
      amountMinor: prepared.amountMinor,
      currencyCode: prepared.currencyCode,
      customerReturnUrl: new URL(`/workspace?payment_order=${orderId}`, request.url).toString(),
      merchantReference: prepared.merchantReference,
      orderId,
    });
    const result = await withWorkflowActor(request, (transaction) =>
      payments.activateCheckout(transaction, { attemptId: prepared.attemptId, ...session }),
    );
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
      status: 201,
    });
  } catch (error) {
    if (attemptId) {
      const failedAttemptId = attemptId;
      await withWorkflowActor(request, (transaction) =>
        payments.failCheckoutCreation(transaction, failedAttemptId),
      ).catch(() => undefined);
    }
    return workflowProblem(error, request);
  }
}
