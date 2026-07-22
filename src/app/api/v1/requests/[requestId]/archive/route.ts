import { CustomerProjectService } from '@/modules/customer-projects';
import { withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const service = new CustomerProjectService();
type Context = Readonly<{ params: Promise<Readonly<{ requestId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { requestId } = await context.params;
    await withWorkflowActor(request, (transaction) => service.archiveRequest(transaction, requestId));
    return new Response(null, { status: 204 });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
