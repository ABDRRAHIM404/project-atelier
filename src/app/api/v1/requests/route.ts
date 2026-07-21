import { CustomerProjectService } from '@/modules/customer-projects';
import { readJsonObject, withWorkflowActor, workflowProblem } from '../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const requests = new CustomerProjectService();

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await withWorkflowActor(request, (transaction) =>
      requests.listCustomerRequests(transaction),
    );
    return Response.json(
      { requests: result },
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
      requests.createDirectRequest(transaction, {
        customerNotes: typeof body.customerNotes === 'string' ? body.customerNotes : undefined,
        dimensions:
          body.dimensions && typeof body.dimensions === 'object' && !Array.isArray(body.dimensions)
            ? (body.dimensions as Record<string, number | string>)
            : undefined,
        productId: typeof body.productId === 'string' ? body.productId : '',
        selections:
          body.selections && typeof body.selections === 'object' && !Array.isArray(body.selections)
            ? (body.selections as Record<string, string | string[]>)
            : undefined,
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
