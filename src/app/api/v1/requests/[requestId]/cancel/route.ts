import { CustomerProjectService } from '@/modules/customer-projects';
import { readJsonObject, withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const service = new CustomerProjectService();
type Context = Readonly<{ params: Promise<Readonly<{ requestId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { requestId } = await context.params;
    const body = await readJsonObject(request);
    await withWorkflowActor(request, (transaction) =>
      service.cancelRequest(transaction, requestId, String(body.reason ?? '')),
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
