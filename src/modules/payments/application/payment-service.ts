import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';
import { z } from 'zod';

import type { ActorScopedTransaction } from '../../../platform/database';
import type {
  CheckoutSessionResult,
  VerifiedGatewayEvent,
} from '../ports/hosted-checkout-provider';

const providerCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{1,31}$/u);
const idempotencyKeySchema = z.string().trim().min(8).max(128);
const checkoutActivationSchema = z.object({
  attemptId: z.uuid(),
  checkoutUrl: z.url().refine((value) => value.startsWith('https://')),
  expiresAt: z.iso.datetime().optional(),
  providerSessionId: z.string().trim().min(1).max(255),
});
const gatewayEventSchema = z.object({
  amountMinor: z.number().int().positive(),
  correlationId: z.uuid(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/u),
  eventType: z.string().trim().min(1).max(128),
  merchantReference: z.string().trim().min(8).max(128),
  orderId: z.uuid(),
  paymentMethod: z.enum(['MADA', 'VISA', 'MASTERCARD', 'APPLE_PAY', 'UNKNOWN']),
  payloadDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  providerCode: providerCodeSchema,
  providerEventId: z.string().trim().min(1).max(255),
  providerOccurredAt: z.iso.datetime().optional(),
  providerTransactionId: z.string().trim().min(1).max(255).optional(),
  status: z.enum(['CANCELLED', 'EXPIRED', 'FAILED', 'SUCCEEDED']),
});

type PreparedCheckout = Readonly<{
  amountMinor: number;
  attemptId: string;
  currencyCode: string;
  merchantReference: string;
  orderId: string;
  replay?: CheckoutSessionResult;
}>;

function requireCustomer(transaction: ActorScopedTransaction) {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'customer' || !('customerId' in context)) {
    throw new Error('CUSTOMER_AUTHENTICATION_REQUIRED');
  }
  return Object.freeze({ customerId: context.customerId });
}

function requireProviderWebhook(transaction: ActorScopedTransaction): void {
  if (
    transaction.actorContext.actor.kind !== 'provider_webhook' ||
    transaction.actorContext.assurance !== 'provider_signature'
  ) {
    throw new Error('PAYMENT_WEBHOOK_VERIFICATION_REQUIRED');
  }
}

export class PaymentService {
  async prepareCheckout(
    transaction: ActorScopedTransaction,
    input: Readonly<{ idempotencyKey: string; orderId: string; providerCode: string }>,
  ): Promise<PreparedCheckout> {
    const customer = requireCustomer(transaction);
    const orderId = z.uuid().parse(input.orderId);
    const providerCode = providerCodeSchema.parse(input.providerCode);
    const idempotencyKey = idempotencyKeySchema.parse(input.idempotencyKey);

    const existing = await transaction.query<
      QueryResultRow & {
        amount_minor: string;
        checkout_url: string | null;
        currency_code: string;
        expires_at: Date | null;
        id: string;
        merchant_reference: string;
        provider_session_id: string | null;
        status: string;
      }
    >(
      `select attempt.id, attempt.merchant_reference, attempt.amount_minor,
              attempt.currency_code, attempt.status, session.provider_session_id,
              session.checkout_url, session.expires_at
       from payments.payment_attempts as attempt
       left join payments.checkout_sessions as session
         on session.payment_attempt_id = attempt.id and session.status = 'ACTIVE'
       where attempt.customer_id = $1 and attempt.order_id = $2
         and attempt.idempotency_key = $3
       order by session.created_at desc nulls last
       limit 1`,
      [customer.customerId, orderId, idempotencyKey],
    );
    const existingRow = existing.rows[0];
    if (existingRow) {
      if (
        existingRow.status === 'PENDING' &&
        existingRow.provider_session_id &&
        existingRow.checkout_url
      ) {
        return Object.freeze({
          amountMinor: Number(existingRow.amount_minor),
          attemptId: existingRow.id,
          currencyCode: existingRow.currency_code,
          merchantReference: existingRow.merchant_reference,
          orderId,
          replay: Object.freeze({
            checkoutUrl: existingRow.checkout_url,
            providerSessionId: existingRow.provider_session_id,
            ...(existingRow.expires_at ? { expiresAt: existingRow.expires_at.toISOString() } : {}),
          }),
        });
      }
      if (existingRow.status !== 'CREATED') throw new Error('PAYMENT_ATTEMPT_NOT_REUSABLE');
      return Object.freeze({
        amountMinor: Number(existingRow.amount_minor),
        attemptId: existingRow.id,
        currencyCode: existingRow.currency_code,
        merchantReference: existingRow.merchant_reference,
        orderId,
      });
    }

    const order = await transaction.query<
      QueryResultRow & {
        accepted_total_minor: string;
        currency_code: string;
        customer_details_confirmed_at: Date | null;
        lifecycle_state: string;
        payment_state: string;
      }
    >(
      `select ordered.accepted_total_minor, ordered.currency_code, ordered.lifecycle_state,
              fulfilment.customer_details_confirmed_at,
              payment.current_state as payment_state
       from orders.orders as ordered
       join fulfilment.fulfilments as fulfilment on fulfilment.order_id = ordered.id
       join payments.order_payment_status as payment on payment.order_id = ordered.id
       where ordered.id = $1 and ordered.customer_id = $2
       for update of ordered, payment`,
      [orderId, customer.customerId],
    );
    const row = order.rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    if (row.lifecycle_state !== 'AWAITING_PAYMENT') throw new Error('PAYMENT_NOT_PAYABLE');
    if (!row.customer_details_confirmed_at) throw new Error('FULFILMENT_DETAILS_REQUIRED');
    if (row.payment_state === 'VERIFIED') throw new Error('PAYMENT_ALREADY_VERIFIED');

    const attemptId = randomUUID();
    const merchantReference = `ATL-PAY-${attemptId}`;
    const inserted = await transaction.query<QueryResultRow & { amount_minor: string }>(
      `insert into payments.payment_attempts
         (id, order_id, customer_id, provider_code, merchant_reference,
          idempotency_key, amount_minor, currency_code)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning amount_minor`,
      [
        attemptId,
        orderId,
        customer.customerId,
        providerCode,
        merchantReference,
        idempotencyKey,
        row.accepted_total_minor,
        row.currency_code,
      ],
    );
    return Object.freeze({
      amountMinor: Number(inserted.rows[0]?.amount_minor),
      attemptId,
      currencyCode: row.currency_code,
      merchantReference,
      orderId,
    });
  }

  async activateCheckout(
    transaction: ActorScopedTransaction,
    input: Readonly<{ attemptId: string } & CheckoutSessionResult>,
  ): Promise<Readonly<{ checkoutUrl: string }>> {
    const customer = requireCustomer(transaction);
    const parsed = checkoutActivationSchema.parse(input);
    const attempt = await transaction.query<
      QueryResultRow & { order_id: string; provider_code: string; status: string }
    >(
      `select order_id, provider_code, status
       from payments.payment_attempts
       where id = $1 and customer_id = $2 for update`,
      [parsed.attemptId, customer.customerId],
    );
    const row = attempt.rows[0];
    if (!row) throw new Error('PAYMENT_ATTEMPT_NOT_FOUND');
    if (row.status !== 'CREATED') throw new Error('PAYMENT_ATTEMPT_NOT_REUSABLE');

    await transaction.query(
      `insert into payments.checkout_sessions
         (payment_attempt_id, provider_code, provider_session_id, checkout_url, expires_at)
       values ($1, $2, $3, $4, $5)`,
      [
        parsed.attemptId,
        row.provider_code,
        parsed.providerSessionId,
        parsed.checkoutUrl,
        parsed.expiresAt ?? null,
      ],
    );
    await transaction.query(
      `update payments.payment_attempts set status = 'PENDING' where id = $1`,
      [parsed.attemptId],
    );
    await transaction.query(
      `update payments.order_payment_status
       set current_state = 'CHECKOUT_PENDING', active_attempt_id = $2,
           current_submission_id = null
       where order_id = $1`,
      [row.order_id, parsed.attemptId],
    );
    return Object.freeze({ checkoutUrl: parsed.checkoutUrl });
  }

  async failCheckoutCreation(
    transaction: ActorScopedTransaction,
    attemptId: string,
  ): Promise<void> {
    const customer = requireCustomer(transaction);
    await transaction.query(
      `update payments.payment_attempts
       set status = 'FAILED', safe_failure_code = 'CHECKOUT_CREATION_FAILED'
       where id = $1 and customer_id = $2 and status = 'CREATED'`,
      [z.uuid().parse(attemptId), customer.customerId],
    );
  }

  async status(
    transaction: ActorScopedTransaction,
    orderId: string,
  ): Promise<
    Readonly<{
      amountMinor: number;
      currencyCode: string;
      paymentState: string;
      providerAvailable: false;
      transaction?: Readonly<{
        amountMinor: number;
        currencyCode: string;
        paidAt: string;
        paymentMethod: string;
        providerCode: string;
        transactionId: string;
      }>;
    }>
  > {
    const kind = transaction.actorContext.actor.kind;
    if (kind !== 'customer' && kind !== 'manager') throw new Error('AUTHENTICATION_REQUIRED');
    const parsedOrderId = z.uuid().parse(orderId);
    const result = await transaction.query<
      QueryResultRow & {
        accepted_total_minor: string;
        currency_code: string;
        payment_state: string;
        transaction_amount_minor: string | null;
        transaction_currency_code: string | null;
        transaction_created_at: Date | null;
        payment_method: string | null;
        provider_code: string | null;
        provider_transaction_id: string | null;
      }
    >(
      `select ordered.accepted_total_minor, ordered.currency_code,
              payment.current_state as payment_state,
              gateway.amount_minor as transaction_amount_minor,
              gateway.currency_code as transaction_currency_code,
              gateway.created_at as transaction_created_at,
              gateway.payment_method, gateway.provider_code,
              gateway.provider_transaction_id
       from orders.orders as ordered
       join payments.order_payment_status as payment on payment.order_id = ordered.id
       left join payments.gateway_transactions as gateway
         on gateway.id = payment.verified_transaction_id
       where ordered.id = $1`,
      [parsedOrderId],
    );
    const row = result.rows[0];
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    const transactionRecord =
      row.provider_transaction_id &&
      row.provider_code &&
      row.payment_method &&
      row.transaction_created_at &&
      row.transaction_amount_minor &&
      row.transaction_currency_code
        ? Object.freeze({
            amountMinor: Number(row.transaction_amount_minor),
            currencyCode: row.transaction_currency_code,
            paidAt: row.transaction_created_at.toISOString(),
            paymentMethod: row.payment_method,
            providerCode: row.provider_code,
            transactionId: row.provider_transaction_id,
          })
        : undefined;
    return Object.freeze({
      amountMinor: Number(row.accepted_total_minor),
      currencyCode: row.currency_code,
      paymentState: row.payment_state,
      providerAvailable: false as const,
      ...(transactionRecord ? { transaction: transactionRecord } : {}),
    });
  }

  async processGatewayEvent(
    transaction: ActorScopedTransaction,
    input: VerifiedGatewayEvent,
  ): Promise<Readonly<{ outcome: 'DUPLICATE' | 'PROCESSED'; orderId: string }>> {
    requireProviderWebhook(transaction);
    const parsed = gatewayEventSchema.parse(input);
    if (parsed.status === 'SUCCEEDED' && !parsed.providerTransactionId) {
      throw new Error('PAYMENT_PROVIDER_TRANSACTION_REQUIRED');
    }

    const semanticKey = `payment:${parsed.merchantReference}:${parsed.status}:${parsed.providerTransactionId ?? parsed.providerEventId}`;
    const registration = await transaction.query<QueryResultRow & { id: string }>(
      `insert into ops.inbound_provider_events
         (provider, provider_event_id, semantic_key, event_type, payload_digest,
          signature_verified, provider_occurred_at, correlation_id)
       values ($1, $2, $3, $4, $5, true, $6, $7)
       on conflict do nothing returning id`,
      [
        parsed.providerCode,
        parsed.providerEventId,
        semanticKey,
        parsed.eventType,
        parsed.payloadDigest,
        parsed.providerOccurredAt ?? null,
        parsed.correlationId,
      ],
    );
    const providerEventId = registration.rows[0]?.id;
    if (!providerEventId) {
      const duplicate = await transaction.query<
        QueryResultRow & { id: string; payload_digest: string }
      >(
        `select id, payload_digest from ops.inbound_provider_events
         where provider = $1 and (provider_event_id = $2 or semantic_key = $3)
         order by (provider_event_id = $2) desc limit 1`,
        [parsed.providerCode, parsed.providerEventId, semanticKey],
      );
      const duplicateRow = duplicate.rows[0];
      if (!duplicateRow) throw new Error('PAYMENT_WEBHOOK_EVENT_CONFLICT');
      if (duplicateRow.payload_digest !== parsed.payloadDigest) {
        throw new Error('PAYMENT_WEBHOOK_DIGEST_CONFLICT');
      }
      return Object.freeze({ orderId: parsed.orderId, outcome: 'DUPLICATE' });
    }

    const attempt = await transaction.query<
      QueryResultRow & {
        amount_minor: string;
        currency_code: string;
        customer_id: string;
        id: string;
        order_id: string;
        status: string;
      }
    >(
      `select id, order_id, customer_id, amount_minor, currency_code, status
       from payments.payment_attempts
       where provider_code = $1 and merchant_reference = $2 for update`,
      [parsed.providerCode, parsed.merchantReference],
    );
    const row = attempt.rows[0];
    if (!row) throw new Error('PAYMENT_ATTEMPT_NOT_FOUND');
    if (
      row.order_id !== parsed.orderId ||
      Number(row.amount_minor) !== parsed.amountMinor ||
      row.currency_code !== parsed.currencyCode
    ) {
      throw new Error('PAYMENT_WEBHOOK_ORDER_MISMATCH');
    }
    if (row.status === 'SUCCEEDED') {
      await transaction.query(
        `update ops.inbound_provider_events
         set process_state = 'IGNORED', safe_result_code = 'PAYMENT_ALREADY_VERIFIED',
             processed_at = clock_timestamp(), updated_at = clock_timestamp()
         where id = $1`,
        [providerEventId],
      );
      return Object.freeze({ orderId: row.order_id, outcome: 'DUPLICATE' });
    }
    if (row.status !== 'PENDING') throw new Error('PAYMENT_ATTEMPT_NOT_PENDING');

    let transactionId: string | undefined;
    if (parsed.providerTransactionId) {
      transactionId = randomUUID();
      await transaction.query(
        `insert into payments.gateway_transactions
           (id, payment_attempt_id, order_id, provider_code, provider_transaction_id,
            payment_method, amount_minor, currency_code, status, provider_event_id,
            provider_occurred_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          transactionId,
          row.id,
          row.order_id,
          parsed.providerCode,
          parsed.providerTransactionId,
          parsed.paymentMethod,
          parsed.amountMinor,
          parsed.currencyCode,
          parsed.status,
          providerEventId,
          parsed.providerOccurredAt ?? null,
        ],
      );
    }

    await transaction.query(
      `update payments.payment_attempts
       set status = $2, safe_failure_code = $3 where id = $1`,
      [row.id, parsed.status, parsed.status === 'SUCCEEDED' ? null : `PROVIDER_${parsed.status}`],
    );
    await transaction.query(
      `update payments.checkout_sessions
       set status = $2
       where payment_attempt_id = $1 and status = 'ACTIVE'`,
      [row.id, parsed.status === 'SUCCEEDED' ? 'COMPLETED' : parsed.status],
    );

    if (parsed.status === 'SUCCEEDED') {
      await transaction.query(
        `update payments.order_payment_status
         set current_state = 'VERIFIED', active_attempt_id = $2,
             verified_transaction_id = $3, verified_decision_id = null,
             verification_source = 'PROVIDER_WEBHOOK'
         where order_id = $1`,
        [row.order_id, row.id, transactionId],
      );
      await transaction.query(
        `update orders.orders set lifecycle_state = 'PAYMENT_VERIFIED' where id = $1`,
        [row.order_id],
      );
    } else {
      await transaction.query(
        `update payments.order_payment_status
         set current_state = $2, active_attempt_id = $3,
             verified_transaction_id = null, verified_decision_id = null,
             verification_source = null
         where order_id = $1`,
        [row.order_id, parsed.status, row.id],
      );
    }

    await transaction.query(`select notifications.notify_online_payment_result($1, $2, $3)`, [
      row.order_id,
      `PAYMENT_${parsed.status === 'SUCCEEDED' ? 'VERIFIED' : parsed.status}`,
      `payment:${parsed.providerCode}:${parsed.providerEventId}:${parsed.status}`,
    ]);
    await transaction.query(
      `insert into audit.events
         (event_type, actor_kind, target_type, target_id, operation, outcome,
          state_before, state_after, correlation_id, metadata_json)
       values
         ('PAYMENT_GATEWAY_EVENT_PROCESSED', 'provider_webhook', 'Order', $1,
          'PROCESS_PAYMENT_GATEWAY_EVENT', 'SUCCEEDED', 'CHECKOUT_PENDING', $2::text,
          $3, jsonb_build_object('provider', $4::text, 'result_code', $5::text))`,
      [
        row.order_id,
        parsed.status,
        parsed.correlationId,
        parsed.providerCode,
        `PAYMENT_${parsed.status}`,
      ],
    );
    await transaction.query(
      `update ops.inbound_provider_events
       set process_state = 'PROCESSED', safe_result_code = $2,
           processed_at = clock_timestamp(), updated_at = clock_timestamp()
       where id = $1`,
      [providerEventId, `PAYMENT_${parsed.status}`],
    );
    return Object.freeze({ orderId: row.order_id, outcome: 'PROCESSED' });
  }
}
