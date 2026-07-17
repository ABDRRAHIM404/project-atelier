import type { QueryResultRow } from 'pg';

import type { ActorScopedTransaction } from '../../../platform/database';

export type NotificationSummary = Readonly<{
  body: string;
  createdAt: string;
  eventType: string;
  id: string;
  read: boolean;
  resourceId: string;
  resourceType: string;
  title: string;
}>;

function principalId(transaction: ActorScopedTransaction): string {
  const actor = transaction.actorContext.actor;
  if (actor.kind !== 'customer' && actor.kind !== 'manager') {
    throw new Error('AUTHENTICATION_REQUIRED');
  }
  return actor.principalId;
}

export class NotificationService {
  async list(transaction: ActorScopedTransaction): Promise<readonly NotificationSummary[]> {
    const actorPrincipalId = principalId(transaction);
    const result = await transaction.query<
      QueryResultRow & {
        body_ar: string;
        created_at: Date;
        event_type: string;
        id: string;
        read_at: Date | null;
        resource_id: string;
        resource_type: string;
        title_ar: string;
      }
    >(
      `select id, event_type, resource_type, resource_id, title_ar, body_ar,
              created_at, read_at
       from notifications.notifications
       where recipient_principal_id = $1
       order by created_at desc limit 100`,
      [actorPrincipalId],
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          body: row.body_ar,
          createdAt: row.created_at.toISOString(),
          eventType: row.event_type,
          id: row.id,
          read: row.read_at !== null,
          resourceId: row.resource_id,
          resourceType: row.resource_type,
          title: row.title_ar,
        }),
      ),
    );
  }

  async markRead(transaction: ActorScopedTransaction, notificationId: string): Promise<void> {
    principalId(transaction);
    const result = await transaction.query(
      `update notifications.notifications set read_at = coalesce(read_at, clock_timestamp())
       where id = $1`,
      [notificationId],
    );
    if (result.rowCount === 0) throw new Error('NOTIFICATION_NOT_FOUND');
  }
}
