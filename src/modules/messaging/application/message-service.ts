import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';
import { z } from 'zod';

import type { ActorScopedTransaction } from '../../../platform/database';

const messageSchema = z
  .object({
    body: z.string().trim().min(1).max(4000),
    clientMessageKey: z.string().trim().min(8).max(255),
    customerId: z.uuid().optional(),
    orderId: z.uuid().optional(),
    projectId: z.uuid().optional(),
  })
  .refine((value) => !(value.orderId && value.projectId), {
    message: 'A message can reference only one context.',
  });

const readReceiptSchema = z.object({
  customerId: z.uuid().optional(),
  readThroughMessageId: z.uuid(),
});

export type ConversationMessage = Readonly<{
  body: string;
  id: string;
  senderKind: 'CUSTOMER' | 'MANAGER';
  sentAt: string;
}>;

export type ConversationSummary = Readonly<{
  customerCity?: string | undefined;
  customerId: string;
  customerLabel: string;
  customerPhone?: string | undefined;
  lastMessageAt: string;
  lastMessageBody: string;
  lastSenderKind: 'CUSTOMER' | 'MANAGER';
  messageCount: number;
  unreadCount: number;
}>;

export class MessageService {
  async send(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      body: string;
      clientMessageKey: string;
      customerId?: string | undefined;
      orderId?: string | undefined;
      projectId?: string | undefined;
    }>,
  ): Promise<Readonly<{ messageId: string }>> {
    const parsed = messageSchema.parse(input);
    const context = transaction.actorContext;
    let customerId: string;
    let senderKind: 'CUSTOMER' | 'MANAGER';
    let senderPrincipalId: string;

    if (context.actor.kind === 'customer' && 'customerId' in context) {
      customerId = context.customerId;
      senderKind = 'CUSTOMER';
      senderPrincipalId = context.actor.principalId;
      if (parsed.customerId && parsed.customerId !== customerId)
        throw new Error('RESOURCE_NOT_FOUND');
    } else if (context.actor.kind === 'manager') {
      if (!parsed.customerId) throw new Error('CUSTOMER_ID_REQUIRED');
      customerId = parsed.customerId;
      senderKind = 'MANAGER';
      senderPrincipalId = context.actor.principalId;
    } else {
      throw new Error('AUTHENTICATION_REQUIRED');
    }

    if (parsed.projectId) {
      const project = await transaction.query<QueryResultRow & { id: string }>(
        `select id from projects.customer_projects
         where id = $1 and customer_id = $2`,
        [parsed.projectId, customerId],
      );
      if (!project.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
    }
    if (parsed.orderId) {
      const order = await transaction.query<QueryResultRow & { id: string }>(
        `select id from orders.orders where id = $1 and customer_id = $2`,
        [parsed.orderId, customerId],
      );
      if (!order.rows[0]) throw new Error('RESOURCE_NOT_FOUND');
    }

    const existing = await transaction.query<QueryResultRow & { id: string }>(
      `select id from messaging.conversations where customer_id = $1`,
      [customerId],
    );
    const conversationId = existing.rows[0]?.id ?? randomUUID();
    if (!existing.rows[0]) {
      await transaction.query(
        `insert into messaging.conversations (id, customer_id) values ($1, $2)`,
        [conversationId, customerId],
      );
    }
    const messageId = randomUUID();
    await transaction.query(
      `insert into messaging.messages
         (id, conversation_id, sender_principal_id, sender_kind, body,
          project_id, order_id, client_message_key)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        messageId,
        conversationId,
        senderPrincipalId,
        senderKind,
        parsed.body,
        parsed.projectId ?? null,
        parsed.orderId ?? null,
        parsed.clientMessageKey,
      ],
    );
    return Object.freeze({ messageId });
  }

  async listConversations(
    transaction: ActorScopedTransaction,
  ): Promise<readonly ConversationSummary[]> {
    if (transaction.actorContext.actor.kind !== 'manager') {
      throw new Error('MANAGER_AUTHENTICATION_REQUIRED');
    }
    const result = await transaction.query<
      QueryResultRow & {
        customer_city: string | null;
        customer_id: string;
        customer_label: string;
        customer_phone: string | null;
        last_message_at: Date;
        last_message_body: string;
        last_sender_kind: 'CUSTOMER' | 'MANAGER';
        message_count: string;
        unread_count: string;
      }
    >(
      `select c.customer_id,
              coalesce(nullif(trim(customer.full_name), ''), customer.contact_email,
                       customer.verified_email_snapshot, 'عميل') as customer_label,
              customer.phone_number as customer_phone,
              customer.city as customer_city,
              latest.body as last_message_body,
              latest.sender_kind as last_sender_kind,
              latest.sent_at as last_message_at,
              counts.message_count,
              counts.unread_count
       from messaging.conversations c
       join iam.customers customer on customer.id = c.customer_id
       join lateral (
         select m.body, m.sender_kind, m.sent_at
         from messaging.messages m
         where m.conversation_id = c.id
         order by m.sent_at desc, m.id desc
         limit 1
       ) latest on true
       join lateral (
         select count(*)::text as message_count,
                count(*) filter (
                  where m.sender_kind = 'CUSTOMER'
                    and (c.manager_last_read_at is null or m.sent_at > c.manager_last_read_at)
                )::text as unread_count
         from messaging.messages m
         where m.conversation_id = c.id
       ) counts on true
       order by latest.sent_at desc, c.customer_id`,
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          customerCity: row.customer_city ?? undefined,
          customerId: row.customer_id,
          customerLabel: row.customer_label,
          customerPhone: row.customer_phone ?? undefined,
          lastMessageAt: row.last_message_at.toISOString(),
          lastMessageBody: row.last_message_body,
          lastSenderKind: row.last_sender_kind,
          messageCount: Number(row.message_count),
          unreadCount: Number(row.unread_count),
        }),
      ),
    );
  }

  async unreadCount(
    transaction: ActorScopedTransaction,
  ): Promise<Readonly<{ unreadCount: number }>> {
    const context = transaction.actorContext;
    if (context.actor.kind === 'customer' && 'customerId' in context) {
      const result = await transaction.query<QueryResultRow & { unread_count: string }>(
        `select count(m.id)::text as unread_count
         from messaging.conversations c
         left join messaging.messages m
           on m.conversation_id = c.id
          and m.sender_kind = 'MANAGER'
          and (c.customer_last_read_at is null or m.sent_at > c.customer_last_read_at)
         where c.customer_id = $1`,
        [context.customerId],
      );
      return Object.freeze({ unreadCount: Number(result.rows[0]?.unread_count ?? 0) });
    }
    if (context.actor.kind === 'manager') {
      const result = await transaction.query<QueryResultRow & { unread_count: string }>(
        `select count(m.id)::text as unread_count
         from messaging.conversations c
         join messaging.messages m
           on m.conversation_id = c.id
          and m.sender_kind = 'CUSTOMER'
          and (c.manager_last_read_at is null or m.sent_at > c.manager_last_read_at)`,
      );
      return Object.freeze({ unreadCount: Number(result.rows[0]?.unread_count ?? 0) });
    }
    throw new Error('AUTHENTICATION_REQUIRED');
  }

  async markRead(
    transaction: ActorScopedTransaction,
    input: Readonly<{ customerId?: string | undefined; readThroughMessageId: string }>,
  ): Promise<Readonly<{ unreadCount: number }>> {
    const parsed = readReceiptSchema.parse(input);
    const context = transaction.actorContext;
    let customerId: string;
    let expectedSender: 'CUSTOMER' | 'MANAGER';
    let readColumn: 'customer_last_read_at' | 'manager_last_read_at';

    if (context.actor.kind === 'customer' && 'customerId' in context) {
      customerId = context.customerId;
      expectedSender = 'MANAGER';
      readColumn = 'customer_last_read_at';
    } else if (context.actor.kind === 'manager' && parsed.customerId) {
      customerId = parsed.customerId;
      expectedSender = 'CUSTOMER';
      readColumn = 'manager_last_read_at';
    } else {
      throw new Error('AUTHENTICATION_REQUIRED');
    }

    const read = await transaction.query(
      `update messaging.conversations c
       set ${readColumn} =
         greatest(coalesce(c.${readColumn}, '-infinity'::timestamptz), m.sent_at)
       from messaging.messages m
       where c.customer_id = $1
         and m.id = $2
         and m.conversation_id = c.id
         and m.sender_kind = $3
       returning c.id`,
      [customerId, parsed.readThroughMessageId, expectedSender],
    );
    if (read.rowCount !== 1) throw new Error('RESOURCE_NOT_FOUND');

    if (context.actor.kind === 'customer') return this.unreadCount(transaction);
    const conversations = await this.listConversations(transaction);
    return Object.freeze({
      unreadCount: conversations.reduce(
        (total, conversation) => total + conversation.unreadCount,
        0,
      ),
    });
  }

  async list(
    transaction: ActorScopedTransaction,
    customerId?: string,
  ): Promise<readonly ConversationMessage[]> {
    const context = transaction.actorContext;
    let resolvedCustomerId: string;
    if (context.actor.kind === 'customer' && 'customerId' in context) {
      resolvedCustomerId = context.customerId;
    } else if (context.actor.kind === 'manager' && customerId) {
      resolvedCustomerId = customerId;
    } else {
      throw new Error('AUTHENTICATION_REQUIRED');
    }
    const result = await transaction.query<
      QueryResultRow & {
        body: string;
        id: string;
        sender_kind: 'CUSTOMER' | 'MANAGER';
        sent_at: Date;
      }
    >(
      `select m.id, m.sender_kind, m.body, m.sent_at
       from messaging.messages m
       join messaging.conversations c on c.id = m.conversation_id
       where c.customer_id = $1
       order by m.sent_at, m.id`,
      [resolvedCustomerId],
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          body: row.body,
          id: row.id,
          senderKind: row.sender_kind,
          sentAt: row.sent_at.toISOString(),
        }),
      ),
    );
  }
}