import { CustomerProjectService } from '@/modules/customer-projects';
import { readJsonObject, withWorkflowActor, workflowProblem } from '../../../../platform/workflow';

export const dynamic = 'force-dynamic';

const projects = new CustomerProjectService();

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await withWorkflowActor(request, (transaction) =>
      projects.listCustomerProjects(transaction),
    );
    return Response.json(
      { projects: result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return workflowProblem(error, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const result = await withWorkflowActor(request, (transaction) =>
      projects.createProject(transaction, {
        customerNotes: typeof body.customerNotes === 'string' ? body.customerNotes : undefined,
        projectName: typeof body.projectName === 'string' ? body.projectName : '',
      }),
    );
    return Response.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
