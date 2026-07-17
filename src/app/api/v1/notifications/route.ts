import { NotificationService } from '@/modules/notifications';
import { withWorkflowActor, workflowProblem } from '../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const notifications = new NotificationService();

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await withWorkflowActor(request, (transaction) =>
      notifications.list(transaction),
    );
    return Response.json(
      { notifications: result },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return workflowProblem(error, request);
  }
}
