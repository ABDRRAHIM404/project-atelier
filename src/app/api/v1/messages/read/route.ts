import { MessageService } from '@/modules/messaging';
import { readJsonObject, withWorkflowActor, workflowProblem } from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const messages = new MessageService();

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const result = await withWorkflowActor(request, (transaction) =>
      messages.markRead(transaction, {
        customerId: typeof body.customerId === 'string' ? body.customerId : undefined,
        readThroughMessageId:
          typeof body.readThroughMessageId === 'string' ? body.readThroughMessageId : '',
      }),
    );
    return Response.json(result, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
