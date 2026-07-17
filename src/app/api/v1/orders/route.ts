import { OrderQueryService } from '@/modules/orders';
import { withWorkflowActor, workflowProblem } from '../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const orders = new OrderQueryService();

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await withWorkflowActor(request, (transaction) => orders.list(transaction));
    return Response.json({ orders: result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
