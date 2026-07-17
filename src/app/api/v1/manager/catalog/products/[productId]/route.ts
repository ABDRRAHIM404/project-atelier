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

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const [{ productId }, body] = await Promise.all([context.params, readJsonObject(request)]);
    const product = await withWorkflowActor(request, (transaction) =>
      catalog.updateDraft(transaction, {
        description: typeof body.description === 'string' ? body.description : '',
        expectedVersion: integer(body.expectedVersion),
        furnitureType: typeof body.furnitureType === 'string' ? body.furnitureType : '',
        name: typeof body.name === 'string' ? body.name : '',
        productId,
        ...(typeof body.productionInformation === 'string'
          ? { productionInformation: body.productionInformation }
          : {}),
        startingAmountMinor: integer(body.startingAmountMinor),
      }),
    );
    return Response.json(product, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
