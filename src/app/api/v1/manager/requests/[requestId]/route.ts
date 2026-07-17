import { CustomerProjectService } from '@/modules/customer-projects';
import { withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const projects = new CustomerProjectService();

type Context = Readonly<{ params: Promise<Readonly<{ requestId: string }>> }>;

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { requestId } = await context.params;
    const result = await withWorkflowActor(request, (transaction) =>
      projects.getManagerRequest(transaction, requestId),
    );
    if (!result) return Response.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
