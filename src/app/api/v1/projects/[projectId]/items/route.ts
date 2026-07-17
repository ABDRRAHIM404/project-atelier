import { CustomerProjectService } from '@/modules/customer-projects';
import {
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const projects = new CustomerProjectService();

type Context = Readonly<{ params: Promise<Readonly<{ projectId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const [{ projectId }, body] = await Promise.all([context.params, readJsonObject(request)]);
    const result = await withWorkflowActor(request, (transaction) =>
      projects.addItem(transaction, {
        customerNotes: typeof body.customerNotes === 'string' ? body.customerNotes : undefined,
        dimensions:
          body.dimensions && typeof body.dimensions === 'object' && !Array.isArray(body.dimensions)
            ? (body.dimensions as Record<string, number | string>)
            : undefined,
        productId: typeof body.productId === 'string' ? body.productId : '',
        projectId,
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
