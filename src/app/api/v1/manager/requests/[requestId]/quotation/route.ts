import { QuotationService } from '@/modules/quotations-and-acceptance';
import {
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '../../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const quotations = new QuotationService();

type Context = Readonly<{ params: Promise<Readonly<{ requestId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const [{ requestId }, body] = await Promise.all([context.params, readJsonObject(request)]);
    const lines = Array.isArray(body.lines)
      ? body.lines.flatMap((line) => {
          if (!line || typeof line !== 'object' || Array.isArray(line)) return [];
          const value = line as Record<string, unknown>;
          return typeof value.submittedItemId === 'string' &&
            typeof value.itemTotalMinor === 'number'
            ? [{ submittedItemId: value.submittedItemId, itemTotalMinor: value.itemTotalMinor }]
            : [];
        })
      : [];
    const result = await withWorkflowActor(request, (transaction) =>
      quotations.createAndSend(transaction, {
        deliveryMinor: typeof body.deliveryMinor === 'number' ? body.deliveryMinor : undefined,
        fulfilmentMethod: body.fulfilmentMethod === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
        fulfilmentSnapshot:
          body.fulfilmentSnapshot &&
          typeof body.fulfilmentSnapshot === 'object' &&
          !Array.isArray(body.fulfilmentSnapshot)
            ? (body.fulfilmentSnapshot as Record<string, unknown>)
            : undefined,
        lines,
        managerNotes: typeof body.managerNotes === 'string' ? body.managerNotes : undefined,
        productionEstimateText:
          typeof body.productionEstimateText === 'string' ? body.productionEstimateText : '',
        requestId,
        termsSnapshot:
          body.termsSnapshot &&
          typeof body.termsSnapshot === 'object' &&
          !Array.isArray(body.termsSnapshot)
            ? (body.termsSnapshot as Record<string, unknown>)
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
