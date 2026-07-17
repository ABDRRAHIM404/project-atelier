import { QuotationService } from '@/modules/quotations-and-acceptance';
import { withWorkflowActor, workflowProblem } from '../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const quotations = new QuotationService();

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await withWorkflowActor(request, (transaction) =>
      quotations.listCustomerQuotations(transaction),
    );
    return Response.json(
      { quotations: result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return workflowProblem(error, request);
  }
}
