import { PaymentService } from '@/modules/payments';
import {
  readJsonObject,
  requirePrivateUploadsReady,
  withWorkflowActor,
  workflowProblem,
} from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const payments = new PaymentService();

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    requirePrivateUploadsReady();
    const [{ orderId }, body] = await Promise.all([context.params, readJsonObject(request)]);
    const result = await withWorkflowActor(request, (transaction) =>
      payments.submitProof(transaction, {
        declaredReference:
          typeof body.declaredReference === 'string' ? body.declaredReference : undefined,
        orderId,
        proofChecksumSha256:
          typeof body.proofChecksumSha256 === 'string' ? body.proofChecksumSha256 : undefined,
        proofDisplayFilename:
          typeof body.proofDisplayFilename === 'string' ? body.proofDisplayFilename : '',
        proofMediaType:
          body.proofMediaType === 'image/jpeg' ||
          body.proofMediaType === 'image/png' ||
          body.proofMediaType === 'application/pdf'
            ? body.proofMediaType
            : 'application/pdf',
        proofObjectKey: typeof body.proofObjectKey === 'string' ? body.proofObjectKey : '',
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
