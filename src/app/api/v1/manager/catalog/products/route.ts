import {
  ManagerCatalogService,
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const catalog = new ManagerCatalogService();

function amountMinor(value: unknown): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(amount)) throw new Error('VALIDATION_FAILED');
  return amount;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const products = await withWorkflowActor(request, (transaction) => catalog.list(transaction));
    return Response.json({ products }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const product = await withWorkflowActor(request, (transaction) =>
      catalog.createDraft(transaction, {
        description: typeof body.description === 'string' ? body.description : '',
        furnitureType: typeof body.furnitureType === 'string' ? body.furnitureType : '',
        name: typeof body.name === 'string' ? body.name : '',
        ...(typeof body.productionInformation === 'string'
          ? { productionInformation: body.productionInformation }
          : {}),
        startingAmountMinor: amountMinor(body.startingAmountMinor),
      }),
    );
    return Response.json(product, {
      headers: { 'Cache-Control': 'private, no-store' },
      status: 201,
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
