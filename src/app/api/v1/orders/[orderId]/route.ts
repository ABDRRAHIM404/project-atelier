import { OrderQueryService } from '@/modules/orders';
import { withWorkflowActor, workflowProblem } from '../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const orders = new OrderQueryService();

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { orderId } = await context.params;
    const result = await withWorkflowActor(request, (transaction) =>
      orders.get(transaction, orderId),
    );
    if (!result) return Response.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
