import { CustomerProjectService } from '@/modules/customer-projects';
import { withWorkflowActor, workflowProblem } from '../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const projects = new CustomerProjectService();

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await withWorkflowActor(request, (transaction) =>
      projects.listManagerRequests(transaction),
    );
    return Response.json(
      { requests: result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return workflowProblem(error, request);
  }
}
