import { NotificationService } from '@/modules/notifications';
import { withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const notifications = new NotificationService();

type Context = Readonly<{ params: Promise<Readonly<{ notificationId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { notificationId } = await context.params;
    await withWorkflowActor(request, (transaction) =>
      notifications.markRead(transaction, notificationId),
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
