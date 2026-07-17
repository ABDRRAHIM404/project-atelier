import { ManagerCatalogService, withWorkflowActor, workflowProblem } from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const catalog = new ManagerCatalogService();

type Context = Readonly<{ params: Promise<Readonly<{ productId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { productId } = await context.params;
    const product = await withWorkflowActor(request, (transaction) =>
      catalog.publishDraft(transaction, { productId }),
    );
    return Response.json(product, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
