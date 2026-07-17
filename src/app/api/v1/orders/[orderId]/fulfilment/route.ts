import { FulfilmentService } from '@/modules/fulfilment';
import {
  readJsonObject,
  withWorkflowActor,
  workflowProblem,
} from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const fulfilment = new FulfilmentService();

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const [{ orderId }, body] = await Promise.all([context.params, readJsonObject(request)]);
    const result = await withWorkflowActor(request, (transaction) =>
      fulfilment.confirmCustomerDetails(transaction, {
        address: typeof body.address === 'string' ? body.address : undefined,
        city: typeof body.city === 'string' ? body.city : undefined,
        deliveryNotes: typeof body.deliveryNotes === 'string' ? body.deliveryNotes : undefined,
        district: typeof body.district === 'string' ? body.district : undefined,
        mapUrl: typeof body.mapUrl === 'string' ? body.mapUrl : undefined,
        method: body.method === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
        orderId,
        phoneNumber: typeof body.phoneNumber === 'string' ? body.phoneNumber : '',
        pickupNotes: typeof body.pickupNotes === 'string' ? body.pickupNotes : undefined,
      }),
    );
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
