import {
  ManagerCatalogService,
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const catalog = new ManagerCatalogService();

type Context = Readonly<{ params: Promise<Readonly<{ productId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { productId } = await context.params;
    const body = await readJsonObject(request);
    const product = await withWorkflowActor(request, (transaction) =>
      catalog.restoreArchived(transaction, {
        expectedVersion: Number(body.expectedVersion),
        productId,
      }),
    );

    return Response.json(product, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
