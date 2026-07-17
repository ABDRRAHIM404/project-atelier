import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';
import { z } from 'zod';

import type { ActorScopedTransaction } from '../../../platform/database';

const fulfilmentDetailsSchema = z.discriminatedUnion('method', [
  z.object({
    address: z.string().trim().min(5).max(500),
    city: z.string().trim().min(2).max(120),
    deliveryNotes: z.string().trim().max(1000).default(''),
    district: z.string().trim().min(2).max(160),
    mapUrl: z.string().trim().url().max(1000).or(z.literal('')).default(''),
    method: z.literal('DELIVERY'),
    phoneNumber: z.string().trim().min(7).max(30),
  }),
  z.object({
    method: z.literal('PICKUP'),
    phoneNumber: z.string().trim().min(7).max(30),
    pickupNotes: z.string().trim().max(1000).default(''),
  }),
]);

const completeSchema = z.object({
  orderId: z.uuid(),
  proofChecksumSha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/u)
    .optional(),
  proofDisplayFilename: z.string().trim().min(1).max(255),
  proofMediaType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
  proofObjectKey: z
    .string()
    .trim()
    .min(3)
    .max(1024)
    .regex(/^private\/handoff\//u),
});

function requireCustomer(transaction: ActorScopedTransaction): string {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'customer' || !('customerId' in context)) {
    throw new Error('CUSTOMER_AUTHENTICATION_REQUIRED');
  }
  return context.customerId;
}

function requireManagerMfa(transaction: ActorScopedTransaction): string {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'manager' || context.assurance !== 'manager_mfa') {
    throw new Error('MANAGER_MFA_REQUIRED');
  }
  return context.actor.principalId;
}

export class FulfilmentService {
  async confirmCustomerDetails(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      address?: string | undefined;
      city?: string | undefined;
      deliveryNotes?: string | undefined;
      district?: string | undefined;
      mapUrl?: string | undefined;
      method: 'DELIVERY' | 'PICKUP';
      orderId: string;
      phoneNumber: string;
      pickupNotes?: string | undefined;
    }>,
  ): Promise<Readonly<{ method: 'DELIVERY' | 'PICKUP'; orderId: string }>> {
    const customerId = requireCustomer(transaction);
    const parsed = fulfilmentDetailsSchema.parse(input);
    const order = await transaction.query<
      QueryResultRow & { accepted_method: 'DELIVERY' | 'PICKUP'; lifecycle_state: string }
    >(
      `select o.lifecycle_state, f.accepted_method
       from orders.orders o
       join fulfilment.fulfilments f on f.order_id = o.id
       where o.id = $1 and o.customer_id = $2
       for update of o, f`,
      [input.orderId, customerId],
    );
    const row = order.rows[0];
    if (!row || !['AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW'].includes(row.lifecycle_state)) {
      throw new Error('FULFILMENT_DETAILS_NOT_EDITABLE');
    }
    if (row.accepted_method !== parsed.method) {
      throw new Error('FULFILMENT_METHOD_CHANGE_REQUIRES_NEW_QUOTATION');
    }

    const snapshot =
      parsed.method === 'DELIVERY'
        ? {
            address: parsed.address,
            city: parsed.city,
            deliveryNotes: parsed.deliveryNotes,
            district: parsed.district,
            mapUrl: parsed.mapUrl,
            phoneNumber: parsed.phoneNumber,
          }
        : { phoneNumber: parsed.phoneNumber, pickupNotes: parsed.pickupNotes };

    const updated = await transaction.query(
      `update fulfilment.fulfilments
       set accepted_snapshot = $3::jsonb,
           customer_details_confirmed_at = clock_timestamp(),
           updated_at = clock_timestamp(), record_version = record_version + 1
       where order_id = $1
         and exists (select 1 from orders.orders o where o.id = $1 and o.customer_id = $2)
       returning id`,
      [input.orderId, customerId, JSON.stringify(snapshot)],
    );
    if (updated.rowCount !== 1) throw new Error('FULFILMENT_DETAILS_NOT_EDITABLE');

    return Object.freeze({ method: parsed.method, orderId: input.orderId });
  }

  async complete(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      orderId: string;
      proofChecksumSha256?: string | undefined;
      proofDisplayFilename: string;
      proofMediaType: 'application/pdf' | 'image/jpeg' | 'image/png';
      proofObjectKey: string;
    }>,
  ): Promise<Readonly<{ fulfilmentId: string; orderId: string }>> {
    const principalId = requireManagerMfa(transaction);
    const parsed = completeSchema.parse(input);
    const fulfilment = await transaction.query<QueryResultRow & { id: string; state: string }>(
      `select id, state from fulfilment.fulfilments
       where order_id = $1 for update`,
      [parsed.orderId],
    );
    const row = fulfilment.rows[0];
    if (!row || row.state !== 'READY_FOR_HANDOFF') throw new Error('FULFILMENT_NOT_COMPLETABLE');

    await transaction.query(
      `insert into fulfilment.handoff_proofs
         (id, fulfilment_id, proof_object_key, proof_display_filename,
          proof_media_type, proof_checksum_sha256, captured_by_principal_id)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        row.id,
        parsed.proofObjectKey,
        parsed.proofDisplayFilename,
        parsed.proofMediaType,
        parsed.proofChecksumSha256 ?? null,
        principalId,
      ],
    );
    await transaction.query(`update fulfilment.fulfilments set state = 'COMPLETED' where id = $1`, [
      row.id,
    ]);
    await transaction.query(
      `update orders.orders
       set lifecycle_state = 'COMPLETED', completed_at = clock_timestamp()
       where id = $1`,
      [parsed.orderId],
    );
    await transaction.query(
      `insert into notifications.notifications
         (recipient_principal_id, event_type, resource_type, resource_id,
          title_ar, body_ar, event_key)
       select c.principal_id, 'ORDER_COMPLETED', 'ORDER', o.id,
              'اكتمل طلبك', 'تم توثيق تسليم الطلب بنجاح.', $2
       from orders.orders o join iam.customers c on c.id = o.customer_id
       where o.id = $1
       on conflict (recipient_principal_id, event_key) do nothing`,
      [parsed.orderId, `order:${parsed.orderId}:completed`],
    );
    return Object.freeze({ fulfilmentId: row.id, orderId: parsed.orderId });
  }
}
