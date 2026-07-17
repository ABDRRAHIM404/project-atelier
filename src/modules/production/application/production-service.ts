import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';
import { z } from 'zod';

import type { ActorScopedTransaction } from '../../../platform/database';

export const productionStates = [
  'NOT_STARTED',
  'MATERIALS_PREPARATION',
  'IN_PRODUCTION',
  'QUALITY_INSPECTION',
  'READY',
] as const;
export type ProductionState = (typeof productionStates)[number];

const transitionSchema = z.object({
  customerVisibleNote: z.string().trim().max(1000).default(''),
  orderId: z.uuid(),
  toState: z.enum(productionStates),
});

const allowedTransitions = {
  IN_PRODUCTION: ['QUALITY_INSPECTION'],
  MATERIALS_PREPARATION: ['IN_PRODUCTION'],
  NOT_STARTED: ['MATERIALS_PREPARATION'],
  QUALITY_INSPECTION: ['IN_PRODUCTION', 'READY'],
  READY: [],
} as const satisfies Readonly<Record<ProductionState, readonly ProductionState[]>>;

async function manager(transaction: ActorScopedTransaction) {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'manager' || context.assurance !== 'manager_mfa') {
    throw new Error('MANAGER_MFA_REQUIRED');
  }
  const result = await transaction.query<QueryResultRow & { id: string }>(
    `select id from iam.managers where principal_id = $1 and is_active`,
    [context.actor.principalId],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('MANAGER_NOT_ACTIVE');
  return Object.freeze({ id, principalId: context.actor.principalId });
}

export class ProductionService {
  async transition(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      customerVisibleNote?: string | undefined;
      orderId: string;
      toState: ProductionState;
    }>,
  ): Promise<Readonly<{ fromState: ProductionState; sequence: number; toState: ProductionState }>> {
    const actor = await manager(transaction);
    const parsed = transitionSchema.parse(input);
    const current = await transaction.query<
      QueryResultRow & { current_state: ProductionState; next_sequence: number }
    >(
      `select current_state, next_sequence from production.order_production
       where order_id = $1 for update`,
      [parsed.orderId],
    );
    const row = current.rows[0];
    if (!row) throw new Error('ORDER_NOT_FOUND');
    if (
      !(allowedTransitions[row.current_state] as readonly ProductionState[]).includes(
        parsed.toState,
      )
    ) {
      throw new Error('PRODUCTION_TRANSITION_FORBIDDEN');
    }

    await transaction.query(
      `update production.order_production
       set current_state = $2, next_sequence = next_sequence + 1
       where order_id = $1`,
      [parsed.orderId, parsed.toState],
    );
    await transaction.query(
      `insert into production.production_updates
         (id, order_id, sequence, from_state, to_state, manager_id, customer_visible_note)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        parsed.orderId,
        row.next_sequence,
        row.current_state,
        parsed.toState,
        actor.id,
        parsed.customerVisibleNote,
      ],
    );

    if (row.current_state === 'NOT_STARTED') {
      await transaction.query(
        `update orders.orders set lifecycle_state = 'IN_PRODUCTION' where id = $1`,
        [parsed.orderId],
      );
      await transaction.query(
        `insert into notifications.notifications
           (recipient_principal_id, event_type, resource_type, resource_id,
            title_ar, body_ar, event_key)
         select c.principal_id, 'PRODUCTION_STARTED', 'ORDER', o.id,
                'بدأ تنفيذ طلبك', 'انتقل الطلب إلى تجهيز المواد.', $2
         from orders.orders o join iam.customers c on c.id = o.customer_id
         where o.id = $1
         on conflict (recipient_principal_id, event_key) do nothing`,
        [parsed.orderId, `order:${parsed.orderId}:production-started`],
      );
    }
    if (parsed.toState === 'READY') {
      await transaction.query(
        `update orders.orders set lifecycle_state = 'READY_FOR_FULFILMENT' where id = $1`,
        [parsed.orderId],
      );
      await transaction.query(
        `update fulfilment.fulfilments set state = 'READY_FOR_HANDOFF'
         where order_id = $1`,
        [parsed.orderId],
      );
      await transaction.query(
        `insert into notifications.notifications
           (recipient_principal_id, event_type, resource_type, resource_id,
            title_ar, body_ar, event_key)
         select c.principal_id, 'ORDER_READY', 'ORDER', o.id,
                'طلبك جاهز', 'أصبح الطلب جاهزًا للتسليم أو الاستلام.', $2
         from orders.orders o join iam.customers c on c.id = o.customer_id
         where o.id = $1
         on conflict (recipient_principal_id, event_key) do nothing`,
        [parsed.orderId, `order:${parsed.orderId}:ready`],
      );
    }

    return Object.freeze({
      fromState: row.current_state,
      sequence: row.next_sequence,
      toState: parsed.toState,
    });
  }
}
