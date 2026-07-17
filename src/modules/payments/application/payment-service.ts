import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';
import { z } from 'zod';

import type { ActorScopedTransaction } from '../../../platform/database';

const submissionSchema = z.object({
  declaredReference: z.string().trim().max(160).default(''),
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
    .regex(/^private\/payment-proofs\//u),
});

const decisionSchema = z.object({
  outcome: z.enum(['REJECTED', 'VERIFIED']),
  safeReason: z.string().trim().max(1000).default(''),
  submissionId: z.uuid(),
});

function customerActor(transaction: ActorScopedTransaction) {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'customer' || !('customerId' in context)) {
    throw new Error('CUSTOMER_AUTHENTICATION_REQUIRED');
  }
  return Object.freeze({ customerId: context.customerId, principalId: context.actor.principalId });
}

async function managerActor(
  transaction: ActorScopedTransaction,
): Promise<Readonly<{ id: string; principalId: string }>> {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'manager' || context.assurance !== 'manager_mfa') {
    throw new Error('MANAGER_MFA_REQUIRED');
  }
  const manager = await transaction.query<QueryResultRow & { id: string }>(
    `select id from iam.managers where principal_id = $1 and is_active`,
    [context.actor.principalId],
  );
  const id = manager.rows[0]?.id;
  if (!id) throw new Error('MANAGER_NOT_ACTIVE');
  return Object.freeze({ id, principalId: context.actor.principalId });
}

export class PaymentService {
  async submitProof(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      declaredReference?: string | undefined;
      orderId: string;
      proofChecksumSha256?: string | undefined;
      proofDisplayFilename: string;
      proofMediaType: 'application/pdf' | 'image/jpeg' | 'image/png';
      proofObjectKey: string;
    }>,
  ): Promise<Readonly<{ submissionId: string }>> {
    const actor = customerActor(transaction);
    const parsed = submissionSchema.parse(input);
    const order = await transaction.query<QueryResultRow & { lifecycle_state: string }>(
      `select lifecycle_state from orders.orders
       where id = $1 and customer_id = $2 for update`,
      [parsed.orderId, actor.customerId],
    );
    const orderRow = order.rows[0];
    if (
      !orderRow ||
      !['AWAITING_PAYMENT', 'PAYMENT_UNDER_REVIEW'].includes(orderRow.lifecycle_state)
    ) {
      throw new Error('PAYMENT_NOT_SUBMITTABLE');
    }
    const fulfilment = await transaction.query<
      QueryResultRow & { customer_details_confirmed_at: Date | null }
    >(
      `select customer_details_confirmed_at from fulfilment.fulfilments
       where order_id = $1 for update`,
      [parsed.orderId],
    );
    if (!fulfilment.rows[0]?.customer_details_confirmed_at) {
      throw new Error('FULFILMENT_DETAILS_REQUIRED');
    }

    const status = await transaction.query<QueryResultRow & { current_state: string }>(
      `select current_state from payments.order_payment_status
       where order_id = $1 for update`,
      [parsed.orderId],
    );
    const current = status.rows[0]?.current_state;
    if (!current || !['AWAITING_SUBMISSION', 'REJECTED'].includes(current)) {
      throw new Error('PAYMENT_NOT_SUBMITTABLE');
    }

    const submissionId = randomUUID();
    await transaction.query(
      `insert into payments.payment_submissions
         (id, order_id, customer_id, proof_object_key, proof_display_filename,
          proof_media_type, proof_checksum_sha256, declared_reference)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        submissionId,
        parsed.orderId,
        actor.customerId,
        parsed.proofObjectKey,
        parsed.proofDisplayFilename,
        parsed.proofMediaType,
        parsed.proofChecksumSha256 ?? null,
        parsed.declaredReference,
      ],
    );
    await transaction.query(
      `update payments.order_payment_status
       set current_state = 'SUBMITTED', current_submission_id = $2
       where order_id = $1`,
      [parsed.orderId, submissionId],
    );
    if (orderRow.lifecycle_state === 'AWAITING_PAYMENT') {
      await transaction.query(
        `update orders.orders set lifecycle_state = 'PAYMENT_UNDER_REVIEW'
         where id = $1`,
        [parsed.orderId],
      );
    }
    await transaction.query(
      `insert into notifications.notifications
         (recipient_principal_id, event_type, resource_type, resource_id,
          title_ar, body_ar, event_key)
       select m.principal_id, 'PAYMENT_RECEIVED', 'ORDER', $1,
              'إثبات تحويل جديد', 'أرسل العميل إثبات التحويل للمراجعة.', $2
       from iam.managers m where m.is_active
       on conflict (recipient_principal_id, event_key) do nothing`,
      [parsed.orderId, `payment:${submissionId}:received`],
    );
    return Object.freeze({ submissionId });
  }

  async decide(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      outcome: 'REJECTED' | 'VERIFIED';
      safeReason?: string | undefined;
      submissionId: string;
    }>,
  ): Promise<Readonly<{ outcome: 'REJECTED' | 'VERIFIED'; orderId: string }>> {
    const manager = await managerActor(transaction);
    const parsed = decisionSchema.parse(input);
    if (parsed.outcome === 'REJECTED' && parsed.safeReason.length < 2) {
      throw new Error('PAYMENT_REJECTION_REASON_REQUIRED');
    }

    const submission = await transaction.query<
      QueryResultRow & { customer_id: string; order_id: string }
    >(
      `select order_id, customer_id from payments.payment_submissions
       where id = $1`,
      [parsed.submissionId],
    );
    const submissionRow = submission.rows[0];
    if (!submissionRow) throw new Error('PAYMENT_SUBMISSION_NOT_FOUND');

    const existing = await transaction.query<QueryResultRow & { outcome: 'REJECTED' | 'VERIFIED' }>(
      `select outcome from payments.payment_verifications
       where submission_id = $1`,
      [parsed.submissionId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].outcome !== parsed.outcome) throw new Error('PAYMENT_DECISION_CONFLICT');
      return Object.freeze({ outcome: parsed.outcome, orderId: submissionRow.order_id });
    }

    const status = await transaction.query<
      QueryResultRow & { current_state: string; current_submission_id: string | null }
    >(
      `select current_state, current_submission_id
       from payments.order_payment_status where order_id = $1 for update`,
      [submissionRow.order_id],
    );
    const statusRow = status.rows[0];
    if (
      !statusRow ||
      statusRow.current_state !== 'SUBMITTED' ||
      statusRow.current_submission_id !== parsed.submissionId
    ) {
      throw new Error('PAYMENT_SUBMISSION_NOT_CURRENT');
    }

    const decisionId = randomUUID();
    await transaction.query(
      `insert into payments.payment_verifications
         (id, order_id, submission_id, manager_id, outcome, safe_reason)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        decisionId,
        submissionRow.order_id,
        parsed.submissionId,
        manager.id,
        parsed.outcome,
        parsed.safeReason,
      ],
    );

    if (parsed.outcome === 'VERIFIED') {
      await transaction.query(
        `update payments.order_payment_status
         set current_state = 'VERIFIED', verified_decision_id = $2
         where order_id = $1`,
        [submissionRow.order_id, decisionId],
      );
      await transaction.query(
        `update orders.orders set lifecycle_state = 'PAYMENT_VERIFIED'
         where id = $1`,
        [submissionRow.order_id],
      );
    } else {
      await transaction.query(
        `update payments.order_payment_status set current_state = 'REJECTED'
         where order_id = $1`,
        [submissionRow.order_id],
      );
      await transaction.query(
        `update orders.orders set lifecycle_state = 'AWAITING_PAYMENT'
         where id = $1`,
        [submissionRow.order_id],
      );
    }

    await transaction.query(
      `insert into notifications.notifications
         (recipient_principal_id, event_type, resource_type, resource_id,
          title_ar, body_ar, event_key)
       select c.principal_id, $1, 'ORDER', $2, $3, $4, $5
       from iam.customers c where c.id = $6
       on conflict (recipient_principal_id, event_key) do nothing`,
      parsed.outcome === 'VERIFIED'
        ? [
            'PAYMENT_VERIFIED',
            submissionRow.order_id,
            'تم تأكيد التحويل',
            'تمت مراجعة التحويل ويمكن بدء التنفيذ.',
            `payment:${parsed.submissionId}:verified`,
            submissionRow.customer_id,
          ]
        : [
            'PAYMENT_REJECTED',
            submissionRow.order_id,
            'يلزم إرسال إثبات جديد',
            parsed.safeReason,
            `payment:${parsed.submissionId}:rejected`,
            submissionRow.customer_id,
          ],
    );
    return Object.freeze({ outcome: parsed.outcome, orderId: submissionRow.order_id });
  }
}
