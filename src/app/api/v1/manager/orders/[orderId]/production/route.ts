import { ProductionService, productionStates, type ProductionState } from '@/modules/production';
import {
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '../../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const production = new ProductionService();

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const [{ orderId }, body] = await Promise.all([context.params, readJsonObject(request)]);
    const toState =
      typeof body.toState === 'string' && productionStates.includes(body.toState as ProductionState)
        ? (body.toState as ProductionState)
        : 'NOT_STARTED';
    const result = await withWorkflowActor(request, (transaction) =>
      production.transition(transaction, {
        customerVisibleNote:
          typeof body.customerVisibleNote === 'string' ? body.customerVisibleNote : undefined,
        orderId,
        toState,
      }),
    );
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
