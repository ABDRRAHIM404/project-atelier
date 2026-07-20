import {
  ManagerCatalogService,
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const catalog = new ManagerCatalogService();

type Context = Readonly<{ params: Promise<Readonly<{ productId: string }>> }>;

function integer(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error('VALIDATION_FAILED');
  return parsed;
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const [{ productId }, body] = await Promise.all([context.params, readJsonObject(request)]);
    const product = await withWorkflowActor(request, (transaction) =>
      catalog.restoreArchived(transaction, {
        expectedVersion: integer(body.expectedVersion),
        productId,
      }),
    );
    return Response.json(product, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
