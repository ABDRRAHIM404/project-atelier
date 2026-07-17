import { PaymentService } from '@/modules/payments';
import {
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '../../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const payments = new PaymentService();

type Context = Readonly<{ params: Promise<Readonly<{ submissionId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const [{ submissionId }, body] = await Promise.all([
      context.params,
      readJsonObject(request).catch((): Record<string, unknown> => ({})),
    ]);
    const result = await withWorkflowActor(request, (transaction) =>
      payments.decide(transaction, {
        outcome: 'VERIFIED',
        safeReason: typeof body.safeReason === 'string' ? body.safeReason : '',
        submissionId,
      }),
    );
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
