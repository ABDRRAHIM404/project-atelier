import { withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { orderId } = await context.params;
    await withWorkflowActor(request, async (transaction) => {
      const actorContext = transaction.actorContext;
      if (
        actorContext.actor.kind !== 'customer' &&
        !(actorContext.actor.kind === 'manager' && actorContext.assurance === 'manager_mfa')
      ) {
        throw new Error('AUTHENTICATION_REQUIRED');
      }

      const customerId = 'customerId' in actorContext ? actorContext.customerId : undefined;
      const result = await transaction.query(
        `update orders.orders
         set archived_at = clock_timestamp(), updated_at = clock_timestamp(),
             record_version = record_version + 1
         where id = $1
           and ($2::uuid is null or customer_id = $2)
           and lifecycle_state in ('CANCELLED', 'COMPLETED')
           and archived_at is null`,
        [orderId, customerId ?? null],
      );
      if (result.rowCount === 0) throw new Error('ORDER_NOT_ARCHIVABLE');
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
