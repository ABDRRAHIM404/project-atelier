import type { QueryResultRow } from 'pg';

import type { ActorScopedTransaction } from '../../../platform/database';

function requireActor(transaction: ActorScopedTransaction): 'customer' | 'manager' {
  const kind = transaction.actorContext.actor.kind;
  if (kind !== 'customer' && kind !== 'manager') throw new Error('AUTHENTICATION_REQUIRED');
  return kind;
}

export type OrderSummary = Readonly<{
  createdAt: string;
  currencyCode: string;
  displayReference: string;
  fulfilmentMethod: 'DELIVERY' | 'PICKUP';
  fulfilmentState: string;
  id: string;
  lifecycleState: string;
  paymentState: string;
  productionState: string;
  totalMinor: number;
}>;

export type OrderDetail = OrderSummary &
  Readonly<{
    items: readonly Readonly<{
      id: string;
      itemSnapshot: Record<string, unknown>;
      itemTotalMinor: number;
      sequence: number;
    }>[];
    paymentSubmissions: readonly Readonly<{
      displayFilename: string;
      id: string;
      submittedAt: string;
    }>[];
    paymentVerifications: readonly Readonly<{
      decidedAt: string;
      outcome: 'REJECTED' | 'VERIFIED';
      reason: string;
    }>[];
    productionUpdates: readonly Readonly<{
      fromState: string;
      note: string;
      occurredAt: string;
      sequence: number;
      toState: string;
    }>[];
    fulfilmentDetails: Record<string, unknown>;
    fulfilmentDetailsConfirmedAt?: string | undefined;
    terms: Record<string, unknown>;
  }>;

export class OrderQueryService {
  async list(transaction: ActorScopedTransaction): Promise<readonly OrderSummary[]> {
    requireActor(transaction);
    const result = await transaction.query<
      QueryResultRow & {
        accepted_method: 'DELIVERY' | 'PICKUP';
        accepted_total_minor: string;
        created_at: Date;
        currency_code: string;
        display_reference: string;
        fulfilment_state: string;
        id: string;
        lifecycle_state: string;
        payment_state: string;
        production_state: string;
      }
    >(
      `select o.id, o.display_reference, o.lifecycle_state, o.currency_code,
              o.accepted_total_minor, o.created_at,
              p.current_state as payment_state,
              pr.current_state as production_state,
              f.state as fulfilment_state,
              f.accepted_method
       from orders.orders o
       join payments.order_payment_status p on p.order_id = o.id
       join production.order_production pr on pr.order_id = o.id
       join fulfilment.fulfilments f on f.order_id = o.id
       order by o.created_at desc`,
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          createdAt: row.created_at.toISOString(),
          currencyCode: row.currency_code,
          displayReference: row.display_reference,
          fulfilmentMethod: row.accepted_method,
          fulfilmentState: row.fulfilment_state,
          id: row.id,
          lifecycleState: row.lifecycle_state,
          paymentState: row.payment_state,
          productionState: row.production_state,
          totalMinor: Number(row.accepted_total_minor),
        }),
      ),
    );
  }

  async get(
    transaction: ActorScopedTransaction,
    orderId: string,
  ): Promise<OrderDetail | undefined> {
    requireActor(transaction);
    const rows = await this.list(transaction);
    const summary = rows.find((item) => item.id === orderId);
    if (!summary) return undefined;

    const [items, terms, submissions, decisions, updates, fulfilment] = await Promise.all([
      transaction.query<
        QueryResultRow & {
          id: string;
          item_snapshot: Record<string, unknown>;
          item_total_minor: string;
          sequence: number;
        }
      >(
        `select id, sequence, item_snapshot, item_total_minor
         from orders.order_item_snapshots where order_id = $1 order by sequence`,
        [orderId],
      ),
      transaction.query<QueryResultRow & { terms_snapshot: Record<string, unknown> }>(
        `select terms_snapshot from orders.order_terms_snapshots where order_id = $1`,
        [orderId],
      ),
      transaction.query<
        QueryResultRow & { id: string; proof_display_filename: string; submitted_at: Date }
      >(
        `select id, proof_display_filename, submitted_at
         from payments.payment_submissions where order_id = $1 order by submitted_at`,
        [orderId],
      ),
      transaction.query<
        QueryResultRow & { decided_at: Date; outcome: 'REJECTED' | 'VERIFIED'; safe_reason: string }
      >(
        `select outcome, safe_reason, decided_at
         from payments.payment_verifications where order_id = $1 order by decided_at`,
        [orderId],
      ),
      transaction.query<
        QueryResultRow & {
          customer_visible_note: string;
          from_state: string;
          occurred_at: Date;
          sequence: number;
          to_state: string;
        }
      >(
        `select sequence, from_state, to_state, customer_visible_note, occurred_at
         from production.production_updates where order_id = $1 order by sequence`,
        [orderId],
      ),
      transaction.query<
        QueryResultRow & {
          accepted_snapshot: Record<string, unknown>;
          customer_details_confirmed_at: Date | null;
        }
      >(
        `select accepted_snapshot, customer_details_confirmed_at
         from fulfilment.fulfilments where order_id = $1`,
        [orderId],
      ),
    ]);

    return Object.freeze({
      ...summary,
      items: Object.freeze(
        items.rows.map((row) =>
          Object.freeze({
            id: row.id,
            itemSnapshot: row.item_snapshot,
            itemTotalMinor: Number(row.item_total_minor),
            sequence: row.sequence,
          }),
        ),
      ),
      fulfilmentDetails: fulfilment.rows[0]?.accepted_snapshot ?? {},
      fulfilmentDetailsConfirmedAt:
        fulfilment.rows[0]?.customer_details_confirmed_at?.toISOString(),
      paymentSubmissions: Object.freeze(
        submissions.rows.map((row) =>
          Object.freeze({
            displayFilename: row.proof_display_filename,
            id: row.id,
            submittedAt: row.submitted_at.toISOString(),
          }),
        ),
      ),
      paymentVerifications: Object.freeze(
        decisions.rows.map((row) =>
          Object.freeze({
            decidedAt: row.decided_at.toISOString(),
            outcome: row.outcome,
            reason: row.safe_reason,
          }),
        ),
      ),
      productionUpdates: Object.freeze(
        updates.rows.map((row) =>
          Object.freeze({
            fromState: row.from_state,
            note: row.customer_visible_note,
            occurredAt: row.occurred_at.toISOString(),
            sequence: row.sequence,
            toState: row.to_state,
          }),
        ),
      ),
      terms: terms.rows[0]?.terms_snapshot ?? {},
    });
  }
}
