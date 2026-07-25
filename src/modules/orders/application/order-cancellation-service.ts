import { randomUUID } from 'node:crypto';

import type { ActorScopedTransaction } from '../../../platform/database';

export class OrderCancellationService {
  async cancel(
    transaction: ActorScopedTransaction,
    input: Readonly<{ orderId: string; reason: string }>,
  ): Promise<void> {
    const context = transaction.actorContext;
    const actor = context.actor;
    if (actor.kind !== 'customer' && actor.kind !== 'manager') {
      throw new Error('AUTHENTICATION_REQUIRED');
    }
    if (actor.kind === 'manager' && context.assurance !== 'manager_mfa') {
      throw new Error('MANAGER_MFA_REQUIRED');
    }
    const reason = input.reason.trim();
    if (reason.length < 2 || reason.length > 1000) throw new Error('VALIDATION_FAILED');
    const customerId =
      actor.kind === 'customer' && 'customerId' in context ? context.customerId : undefined;
    const result = await transaction.query<{ customer_id: string; lifecycle_state: string }>(
      `select customer_id, lifecycle_state from orders.orders
       where id = $1 ${customerId ? 'and customer_id = $2' : ''} for update`,
      customerId ? [input.orderId, customerId] : [input.orderId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    if (['COMPLETED', 'CANCELLED'].includes(row.lifecycle_state)) {
      throw new Error('ORDER_NOT_CANCELLABLE');
    }

    await transaction.query(
      `update orders.orders
       set lifecycle_state = 'CANCELLED', cancelled_at = clock_timestamp(),
           cancelled_by = $2, cancellation_reason = $3
       where id = $1`,
      [input.orderId, actor.kind.toUpperCase(), reason],
    );

    if (actor.kind === 'customer') {
      await transaction.query(
        `insert into notifications.notifications
           (recipient_principal_id, event_type, resource_type, resource_id,
            title_ar, body_ar, event_key)
         select manager.principal_id, 'ORDER_CANCELLED', 'ORDER', $1,
                'تم إلغاء الطلب', $2, $3
         from iam.managers manager where manager.is_active
         on conflict (recipient_principal_id, event_key) do nothing`,
        [input.orderId, reason, `order:${input.orderId}:cancelled`],
      );
    } else {
      await transaction.query(
        `insert into notifications.notifications
           (recipient_principal_id, event_type, resource_type, resource_id,
            title_ar, body_ar, event_key)
         select customer.principal_id, 'ORDER_CANCELLED', 'ORDER', $1,
                'تم إلغاء الطلب', $2, $3
         from iam.customers customer where customer.id = $4
         on conflict (recipient_principal_id, event_key) do nothing`,
        [input.orderId, reason, `order:${input.orderId}:cancelled`, row.customer_id],
      );
    }

    await transaction.query(
      `insert into audit.events
         (event_type, actor_kind, actor_principal_id, target_type, target_id,
          operation, outcome, state_before, state_after, correlation_id, metadata_json)
       values
         ('ORDER_CANCELLED', $1, $2, 'Order', $3, 'CANCEL_ORDER', 'SUCCEEDED',
          $4, 'CANCELLED', $5, jsonb_build_object('state_from', $4::text, 'state_to', 'CANCELLED'))`,
      [actor.kind, actor.principalId, input.orderId, row.lifecycle_state, randomUUID()],
    );
  }
}
