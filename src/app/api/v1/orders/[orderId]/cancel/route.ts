import { readJsonObject, withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { orderId } = await context.params;
    const body = await readJsonObject(request);
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 2 || reason.length > 1000) throw new Error('VALIDATION_FAILED');
    await withWorkflowActor(request, async (transaction) => {
      const contextActor = transaction.actorContext;
      if (contextActor.actor.kind !== 'customer' && contextActor.actor.kind !== 'manager') {
        throw new Error('AUTHENTICATION_REQUIRED');
      }
      const customerId = contextActor.actor.kind === 'customer' && 'customerId' in contextActor
        ? contextActor.customerId
        : undefined;
      const result = await transaction.query<{ customer_id: string; lifecycle_state: string }>(
        `select customer_id, lifecycle_state from orders.orders
         where id = $1 ${customerId ? 'and customer_id = $2' : ''} for update`,
        customerId ? [orderId, customerId] : [orderId],
      );
      const row = result.rows[0];
      if (!row) throw new Error('RESOURCE_NOT_FOUND');
      if (['COMPLETED', 'CANCELLED'].includes(row.lifecycle_state)) throw new Error('ORDER_NOT_CANCELLABLE');
      await transaction.query(
        `update orders.orders set lifecycle_state = 'CANCELLED', cancelled_at = clock_timestamp(),
         cancelled_by = $2, cancellation_reason = $3 where id = $1`,
        [orderId, contextActor.actor.kind.toUpperCase(), reason],
      );
      if (contextActor.actor.kind === 'customer') {
        await transaction.query(
          `insert into notifications.notifications
             (recipient_principal_id, event_type, resource_type, resource_id, title_ar, body_ar, event_key)
           select m.principal_id, 'ORDER_CANCELLED', 'ORDER', $1,
                  'تم إلغاء الطلب', $2, $3
           from iam.managers m where m.is_active
           on conflict (recipient_principal_id, event_key) do nothing`,
          [orderId, reason, `order:${orderId}:cancelled`],
        );
      } else {
        await transaction.query(
          `insert into notifications.notifications
             (recipient_principal_id, event_type, resource_type, resource_id, title_ar, body_ar, event_key)
           select c.principal_id, 'ORDER_CANCELLED', 'ORDER', $1,
                  'تم إلغاء الطلب', $2, $3
           from iam.customers c where c.id = $4
           on conflict (recipient_principal_id, event_key) do nothing`,
          [orderId, reason, `order:${orderId}:cancelled`, row.customer_id],
        );
      }
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
