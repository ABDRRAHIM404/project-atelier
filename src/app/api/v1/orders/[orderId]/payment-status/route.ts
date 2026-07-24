import { PaymentService } from '@/modules/payments';
import { withWorkflowActor, workflowProblem } from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const payments = new PaymentService();

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { orderId } = await context.params;
    const result = await withWorkflowActor(request, (transaction) =>
      payments.status(transaction, orderId),
    );
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
