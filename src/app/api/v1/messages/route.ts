import { MessageService } from '@/modules/messaging';
import { readJsonObject, withWorkflowActor, workflowProblem } from '../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const messages = new MessageService();

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const customerId = url.searchParams.get('customerId') ?? undefined;
    const view = url.searchParams.get('view');
    if (view === 'unread') {
      const result = await withWorkflowActor(request, (transaction) =>
        messages.unreadCount(transaction),
      );
      return Response.json(result, {
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    if (view === 'conversations') {
      const conversations = await withWorkflowActor(request, (transaction) =>
        messages.listConversations(transaction),
      );
      return Response.json(
        { conversations },
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
    }

    const conversationMessages = await withWorkflowActor(request, (transaction) =>
      messages.list(transaction, customerId),
    );
    return Response.json(
      { messages: conversationMessages },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return workflowProblem(error, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const result = await withWorkflowActor(request, (transaction) =>
      messages.send(transaction, {
        body: typeof body.body === 'string' ? body.body : '',
        clientMessageKey:
          typeof body.clientMessageKey === 'string' ? body.clientMessageKey : crypto.randomUUID(),
        customerId: typeof body.customerId === 'string' ? body.customerId : undefined,
        orderId: typeof body.orderId === 'string' ? body.orderId : undefined,
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
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
