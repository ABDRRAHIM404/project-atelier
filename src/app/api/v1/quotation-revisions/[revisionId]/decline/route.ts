import { QuotationService } from '@/modules/quotations-and-acceptance';
import { readJsonObject, withWorkflowActor, workflowProblem } from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const quotations = new QuotationService();
type Context = Readonly<{ params: Promise<Readonly<{ revisionId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const [{ revisionId }, body] = await Promise.all([context.params, readJsonObject(request)]);
    const result = await withWorkflowActor(request, (transaction) =>
      quotations.decline(transaction, {
        reason: typeof body.reason === 'string' ? body.reason : '',
        revisionId,
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
