import { QuotationService } from '@/modules/quotations-and-acceptance';
import { withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const quotations = new QuotationService();

type Context = Readonly<{ params: Promise<Readonly<{ revisionId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { revisionId } = await context.params;
    const result = await withWorkflowActor(request, (transaction) =>
      quotations.accept(transaction, revisionId),
    );
    return Response.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
