import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';
import { z } from 'zod';

import type { ActorScopedTransaction } from '../../../platform/database';

const quoteLineSchema = z.object({
  itemTotalMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  submittedItemId: z.uuid(),
});

const sendQuotationSchema = z.object({
  deliveryMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  fulfilmentMethod: z.enum(['PICKUP', 'DELIVERY']),
  fulfilmentSnapshot: z.record(z.string(), z.unknown()).default({}),
  lines: z.array(quoteLineSchema).min(1).max(50),
  managerNotes: z.string().trim().max(4000).default(''),
  productionEstimateText: z.string().trim().min(2).max(500),
  requestId: z.uuid(),
  termsSnapshot: z.record(z.string(), z.unknown()).default({}),
});

function requireManagerMfa(transaction: ActorScopedTransaction): string {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'manager' || context.assurance !== 'manager_mfa') {
    throw new Error('MANAGER_MFA_REQUIRED');
  }
  return context.actor.principalId;
}

function requireCustomer(transaction: ActorScopedTransaction) {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'customer' || !('customerId' in context)) {
    throw new Error('CUSTOMER_AUTHENTICATION_REQUIRED');
  }
  return Object.freeze({ customerId: context.customerId, principalId: context.actor.principalId });
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function displayReference(now: Date): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `ATL-${date}-${suffix}`;
}

export type QuotationSummary = Readonly<{
  currencyCode: string;
  requestDisplayReference: string;
  requestId: string;
  requestName: string;
  id: string;
  productionEstimateText: string;
  revisionId: string;
  revisionNumber: number;
  state: string;
  totalMinor: number;
}>;

export class QuotationService {
  async createAndSend(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      deliveryMinor?: number | undefined;
      fulfilmentMethod: 'DELIVERY' | 'PICKUP';
      fulfilmentSnapshot?: Record<string, unknown> | undefined;
      lines: readonly Readonly<{ itemTotalMinor: number; submittedItemId: string }>[];
      managerNotes?: string | undefined;
      productionEstimateText: string;
      requestId: string;
      termsSnapshot?: Record<string, unknown> | undefined;
    }>,
  ): Promise<QuotationSummary> {
    const principalId = requireManagerMfa(transaction);
    const parsed = sendQuotationSchema.parse(input);
    const manager = await transaction.query<QueryResultRow & { id: string }>(
      `select id from iam.managers
       where principal_id = $1 and is_active`,
      [principalId],
    );
    const managerId = manager.rows[0]?.id;
    if (!managerId) throw new Error('MANAGER_NOT_ACTIVE');

    const request = await transaction.query<
      QueryResultRow & {
        customer_id: string;
        display_reference: string;
        project_name_snapshot: string;
        source_project_id: string | null;
        state: string;
      }
    >(
      `select customer_id, source_project_id, state, display_reference, project_name_snapshot
       from projects.submitted_requests
       where id = $1 for update`,
      [parsed.requestId],
    );
    const requestRow = request.rows[0];
    if (!requestRow) throw new Error('REQUEST_NOT_FOUND');
    if (
      ![
        'SUBMITTED',
        'UNDER_REVIEW',
        'WAITING_FOR_CUSTOMER_INFORMATION',
        'READY_FOR_QUOTATION',
        'QUOTED',
      ].includes(requestRow.state)
    ) {
      throw new Error('REQUEST_NOT_QUOTABLE');
    }

    const requestItems = await transaction.query<
      QueryResultRow & {
        configuration_snapshot: Record<string, unknown>;
        customer_notes_snapshot: string;
        id: string;
        product_id: string;
        product_snapshot: Record<string, unknown>;
        sequence: number;
      }
    >(
      `select id, sequence, product_id, product_snapshot,
              configuration_snapshot, customer_notes_snapshot
       from projects.submitted_request_items
       where request_id = $1 order by sequence`,
      [parsed.requestId],
    );
    if (requestItems.rows.length !== parsed.lines.length) {
      throw new Error('QUOTATION_LINES_INCOMPLETE');
    }
    const totals = new Map(parsed.lines.map((line) => [line.submittedItemId, line.itemTotalMinor]));
    if (requestItems.rows.some((item) => !totals.has(item.id))) {
      throw new Error('QUOTATION_LINES_INCOMPLETE');
    }

    let quotation = await transaction.query<
      QueryResultRow & { id: string; lifecycle: string; next_revision_number: number }
    >(
      `select id, lifecycle, next_revision_number
       from quotes.quotations where submitted_request_id = $1 for update`,
      [parsed.requestId],
    );
    let quotationRow = quotation.rows[0];
    if (quotationRow?.lifecycle === 'ACCEPTED') throw new Error('QUOTATION_ALREADY_ACCEPTED');
    if (!quotationRow) {
      const quotationId = randomUUID();
      quotation = await transaction.query(
        `insert into quotes.quotations
           (id, submitted_request_id, customer_id)
         values ($1, $2, $3)
         returning id, lifecycle, next_revision_number`,
        [quotationId, parsed.requestId, requestRow.customer_id],
      );
      quotationRow = quotation.rows[0] as typeof quotationRow;
    }
    if (!quotationRow) throw new Error('QUOTATION_CREATE_FAILED');

    const revisionId = randomUUID();
    const revisionNumber = quotationRow.next_revision_number;
    const subtotalMinor = requestItems.rows.reduce(
      (sum, item) => sum + (totals.get(item.id) ?? 0),
      0,
    );
    await transaction.query(
      `insert into quotes.quotation_revisions
         (id, quotation_id, revision_number, currency_code, subtotal_minor,
          delivery_minor, production_estimate_text, fulfilment_method,
          fulfilment_snapshot, terms_snapshot, manager_notes, authored_by_manager_id)
       values ($1, $2, $3, 'SAR', $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11)`,
      [
        revisionId,
        quotationRow.id,
        revisionNumber,
        subtotalMinor,
        parsed.deliveryMinor,
        parsed.productionEstimateText,
        parsed.fulfilmentMethod,
        JSON.stringify(parsed.fulfilmentSnapshot),
        JSON.stringify(parsed.termsSnapshot),
        parsed.managerNotes,
        managerId,
      ],
    );

    const quoteItems = [];
    for (const item of requestItems.rows) {
      const itemTotalMinor = totals.get(item.id);
      if (itemTotalMinor === undefined) throw new Error('QUOTATION_LINES_INCOMPLETE');
      const itemSnapshot = Object.freeze({
        configuration: item.configuration_snapshot,
        customerNotes: item.customer_notes_snapshot,
        product: item.product_snapshot,
      });
      quoteItems.push(
        Object.freeze({
          itemSnapshot,
          itemTotalMinor,
          sequence: item.sequence,
          sourceSubmittedItemId: item.id,
        }),
      );
      await transaction.query(
        `insert into quotes.quotation_items
           (id, revision_id, source_submitted_item_id, sequence, item_snapshot,
            item_total_minor, currency_code)
         values ($1, $2, $3, $4, $5::jsonb, $6, 'SAR')`,
        [
          randomUUID(),
          revisionId,
          item.id,
          item.sequence,
          JSON.stringify(itemSnapshot),
          itemTotalMinor,
        ],
      );
    }

    const revisionDigest = digest({
      currencyCode: 'SAR',
      deliveryMinor: parsed.deliveryMinor,
      fulfilmentMethod: parsed.fulfilmentMethod,
      fulfilmentSnapshot: parsed.fulfilmentSnapshot,
      items: quoteItems,
      managerNotes: parsed.managerNotes,
      productionEstimateText: parsed.productionEstimateText,
      quotationId: quotationRow.id,
      revisionNumber,
      subtotalMinor,
      termsSnapshot: parsed.termsSnapshot,
    });
    await transaction.query(
      `update quotes.quotation_revisions
       set state = 'SENT', sent_at = clock_timestamp(), digest_sha256 = $2,
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1 and state = 'DRAFT'`,
      [revisionId, revisionDigest],
    );
    await transaction.query(
      `update quotes.quotations
       set lifecycle = 'SENT', current_sent_revision_id = $2,
           next_revision_number = $3, updated_at = clock_timestamp(),
           record_version = record_version + 1
       where id = $1`,
      [quotationRow.id, revisionId, revisionNumber + 1],
    );
    await transaction.query(
      `update projects.submitted_requests set state = 'QUOTED'
       where id = $1`,
      [parsed.requestId],
    );
    await transaction.query(
      `update projects.customer_projects set state = 'QUOTED',
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1`,
      [requestRow.source_project_id],
    );
    await transaction.query(
      `insert into notifications.notifications
         (recipient_principal_id, event_type, resource_type, resource_id,
          title_ar, body_ar, event_key)
       select c.principal_id, 'QUOTATION_SENT', 'QUOTATION', $1,
              'عرض سعر جديد', 'أصبح عرض السعر جاهزًا للمراجعة.', $2
       from iam.customers c where c.id = $3
       on conflict (recipient_principal_id, event_key) do nothing`,
      [quotationRow.id, `quotation:${revisionId}:sent`, requestRow.customer_id],
    );

    return Object.freeze({
      currencyCode: 'SAR',
      requestDisplayReference: requestRow.display_reference,
      requestId: parsed.requestId,
      requestName: requestRow.project_name_snapshot.replace(/^طلب\s+/u, ''),
      id: quotationRow.id,
      productionEstimateText: parsed.productionEstimateText,
      revisionId,
      revisionNumber,
      state: 'SENT',
      totalMinor: subtotalMinor + parsed.deliveryMinor,
    });
  }

  async accept(
    transaction: ActorScopedTransaction,
    revisionId: string,
  ): Promise<Readonly<{ orderId: string; orderReference: string }>> {
    const actor = requireCustomer(transaction);
    const revision = await transaction.query<
      QueryResultRow & {
        currency_code: string;
        delivery_minor: string;
        digest_sha256: string;
        fulfilment_method: 'DELIVERY' | 'PICKUP';
        fulfilment_snapshot: Record<string, unknown>;
        production_estimate_text: string;
        quotation_id: string;
        state: string;
        subtotal_minor: string;
        terms_snapshot: Record<string, unknown>;
        total_minor: string;
      }
    >(
      `select r.quotation_id, r.state, r.currency_code, r.subtotal_minor,
              r.delivery_minor, r.total_minor, r.production_estimate_text,
              r.fulfilment_method, r.fulfilment_snapshot, r.terms_snapshot,
              r.digest_sha256
       from quotes.quotation_revisions r
       join quotes.quotations q on q.id = r.quotation_id
       where r.id = $1 and q.customer_id = $2
         and q.current_sent_revision_id = r.id
       for update of q, r`,
      [revisionId, actor.customerId],
    );
    const row = revision.rows[0];
    if (!row || row.state !== 'SENT' || !row.digest_sha256) {
      throw new Error('QUOTATION_NOT_ACCEPTABLE');
    }

    const existing = await transaction.query<
      QueryResultRow & { id: string; display_reference: string }
    >(
      `select o.id, o.display_reference
       from quotes.customer_acceptances a
       join orders.orders o on o.acceptance_id = a.id
       where a.revision_id = $1 and a.customer_id = $2`,
      [revisionId, actor.customerId],
    );
    const existingOrder = existing.rows[0];
    if (existingOrder) {
      return Object.freeze({
        orderId: existingOrder.id,
        orderReference: existingOrder.display_reference,
      });
    }

    const acceptanceId = randomUUID();
    await transaction.query(
      `insert into quotes.customer_acceptances
         (id, quotation_id, revision_id, customer_id, accepted_digest_sha256)
       values ($1, $2, $3, $4, $5)`,
      [acceptanceId, row.quotation_id, revisionId, actor.customerId, row.digest_sha256],
    );

    const orderId = randomUUID();
    const orderReference = displayReference(new Date());
    await transaction.query(
      `insert into orders.orders
         (id, display_reference, customer_id, acceptance_id, accepted_revision_id,
          currency_code, accepted_total_minor)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        orderId,
        orderReference,
        actor.customerId,
        acceptanceId,
        revisionId,
        row.currency_code,
        row.total_minor,
      ],
    );

    const items = await transaction.query<
      QueryResultRow & {
        currency_code: string;
        id: string;
        item_snapshot: Record<string, unknown>;
        item_total_minor: string;
        sequence: number;
      }
    >(
      `select id, sequence, item_snapshot, item_total_minor, currency_code
       from quotes.quotation_items where revision_id = $1 order by sequence`,
      [revisionId],
    );
    for (const item of items.rows) {
      const productId =
        typeof item.item_snapshot?.product === 'object' && item.item_snapshot.product
          ? (item.item_snapshot.product as Record<string, unknown>).productId
          : null;
      await transaction.query(
        `insert into orders.order_item_snapshots
           (id, order_id, source_quotation_item_id, sequence, product_id,
            item_snapshot, item_total_minor, currency_code)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [
          randomUUID(),
          orderId,
          item.id,
          item.sequence,
          typeof productId === 'string' ? productId : null,
          JSON.stringify(item.item_snapshot),
          item.item_total_minor,
          item.currency_code,
        ],
      );
    }
    await transaction.query(
      `insert into orders.order_terms_snapshots
         (order_id, terms_snapshot, fulfilment_method, fulfilment_snapshot,
          production_estimate_text, accepted_digest_sha256)
       values ($1, $2::jsonb, $3, $4::jsonb, $5, $6)`,
      [
        orderId,
        JSON.stringify(row.terms_snapshot),
        row.fulfilment_method,
        JSON.stringify(row.fulfilment_snapshot),
        row.production_estimate_text,
        row.digest_sha256,
      ],
    );
    await transaction.query(`insert into payments.order_payment_status (order_id) values ($1)`, [
      orderId,
    ]);
    await transaction.query(`insert into production.order_production (order_id) values ($1)`, [
      orderId,
    ]);
    await transaction.query(
      `insert into fulfilment.fulfilments
         (id, order_id, accepted_method, accepted_snapshot)
       values ($1, $2, $3, $4::jsonb)`,
      [randomUUID(), orderId, row.fulfilment_method, JSON.stringify(row.fulfilment_snapshot)],
    );
    await transaction.query(
      `update quotes.quotations
       set lifecycle = 'ACCEPTED', updated_at = clock_timestamp(),
           record_version = record_version + 1
       where id = $1`,
      [row.quotation_id],
    );
    await transaction.query(
      `insert into notifications.notifications
         (recipient_principal_id, event_type, resource_type, resource_id,
          title_ar, body_ar, event_key)
       values ($1, 'QUOTATION_ACCEPTED', 'ORDER', $2,
               'تم اعتماد عرض السعر', $3, $4)
       on conflict (recipient_principal_id, event_key) do nothing`,
      [
        actor.principalId,
        orderId,
        `تم إنشاء الطلب ${orderReference}.`,
        `order:${orderId}:created:customer`,
      ],
    );
    await transaction.query(
      `insert into notifications.notifications
         (recipient_principal_id, event_type, resource_type, resource_id,
          title_ar, body_ar, event_key)
       select m.principal_id, 'QUOTATION_ACCEPTED', 'ORDER', $1,
              'تم قبول عرض السعر', $2, $3
       from iam.managers m where m.is_active
       on conflict (recipient_principal_id, event_key) do nothing`,
      [orderId, `تم إنشاء الطلب ${orderReference}.`, `order:${orderId}:created:manager`],
    );
    return Object.freeze({ orderId, orderReference });
  }

  async decline(
    transaction: ActorScopedTransaction,
    input: Readonly<{ reason: string; revisionId: string }>,
  ): Promise<Readonly<{ quotationId: string }>> {
    const actor = requireCustomer(transaction);
    const reason = z.string().trim().min(2).max(2000).parse(input.reason);
    const revision = await transaction.query<
      QueryResultRow & { quotation_id: string; state: string }
    >(
      `select r.quotation_id, r.state
       from quotes.quotation_revisions r
       join quotes.quotations q on q.id = r.quotation_id
       where r.id = $1 and q.customer_id = $2 and q.current_sent_revision_id = r.id
       for update of q, r`,
      [input.revisionId, actor.customerId],
    );
    const row = revision.rows[0];
    if (!row || row.state !== 'SENT') throw new Error('QUOTATION_NOT_DECLINABLE');

    await transaction.query(
      `insert into quotes.quotation_responses (id, revision_id, customer_id, outcome, reason)
       values ($1, $2, $3, 'DECLINED', $4)`,
      [randomUUID(), input.revisionId, actor.customerId, reason],
    );
    await transaction.query(
      `update quotes.quotations set lifecycle = 'DECLINED', updated_at = clock_timestamp(),
              record_version = record_version + 1 where id = $1`,
      [row.quotation_id],
    );
    await transaction.query(
      `select notifications.notify_managers_of_quotation_decline($1, $2, $3)`,
      [row.quotation_id, input.revisionId, reason],
    );
    return Object.freeze({ quotationId: row.quotation_id });
  }

  async listCustomerQuotations(
    transaction: ActorScopedTransaction,
  ): Promise<readonly QuotationSummary[]> {
    requireCustomer(transaction);
    const result = await transaction.query<
      QueryResultRow & {
        currency_code: string;
        id: string;
        production_estimate_text: string;
        request_display_reference: string;
        request_id: string;
        request_name: string;
        revision_id: string;
        revision_number: number;
        state: string;
        total_minor: string;
      }
    >(
      `select q.id, r.id as revision_id, r.revision_number, q.lifecycle as state,
              r.currency_code, r.total_minor, r.production_estimate_text,
              sr.id as request_id, sr.display_reference as request_display_reference,
              regexp_replace(sr.project_name_snapshot, '^طلب\\s+', '') as request_name
       from quotes.quotations q
       join quotes.quotation_revisions r on r.id = q.current_sent_revision_id
       join projects.submitted_requests sr on sr.id = q.submitted_request_id
       order by r.sent_at desc`,
    );
    return Object.freeze(
      result.rows.map((item) =>
        Object.freeze({
          currencyCode: item.currency_code,
          requestDisplayReference: item.request_display_reference,
          requestId: item.request_id,
          requestName: item.request_name,
          id: item.id,
          productionEstimateText: item.production_estimate_text,
          revisionId: item.revision_id,
          revisionNumber: item.revision_number,
          state: item.state,
          totalMinor: Number(item.total_minor),
        }),
      ),
    );
  }
}
