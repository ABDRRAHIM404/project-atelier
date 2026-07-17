import { CustomerProjectService } from '@/modules/customer-projects';
import { withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const projects = new CustomerProjectService();

type Context = Readonly<{ params: Promise<Readonly<{ projectId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { projectId } = await context.params;
    const result = await withWorkflowActor(request, (transaction) =>
      projects.submitProject(transaction, projectId),
    );
    return Response.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
