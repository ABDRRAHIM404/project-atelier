import { OrderCancellationService } from '@/modules/orders';
import {
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const service = new OrderCancellationService();
type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { orderId } = await context.params;
    const body = await readJsonObject(request);
    await withWorkflowActor(request, (transaction) =>
      service.cancel(transaction, { orderId, reason: String(body.reason ?? '') }),
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
