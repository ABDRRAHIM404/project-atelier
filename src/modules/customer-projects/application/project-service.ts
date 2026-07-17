import { randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';
import { z } from 'zod';

import type { ActorScopedTransaction } from '../../../platform/database';

const createProjectSchema = z.object({
  customerNotes: z.string().trim().max(4000).default(''),
  projectName: z.string().trim().min(2).max(120),
});

const addItemSchema = z.object({
  customerNotes: z.string().trim().max(2000).default(''),
  dimensions: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  productId: z.uuid(),
  projectId: z.uuid(),
  selections: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
});

function customerActor(transaction: ActorScopedTransaction) {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'customer' || !('customerId' in context)) {
    throw new Error('CUSTOMER_AUTHENTICATION_REQUIRED');
  }
  return Object.freeze({ customerId: context.customerId, principalId: context.actor.principalId });
}

function managerActor(transaction: ActorScopedTransaction) {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'manager') throw new Error('MANAGER_AUTHENTICATION_REQUIRED');
  return context.actor.principalId;
}

export type CustomerProjectSummary = Readonly<{
  createdAt: string;
  id: string;
  itemCount: number;
  name: string;
  state: string;
  version: number;
}>;

export type SubmittedRequestSummary = Readonly<{
  customerId: string;
  customerLabel: string;
  id: string;
  itemCount: number;
  projectId: string;
  projectName: string;
  state: string;
  submittedAt: string;
}>;

export type SubmittedRequestDetail = SubmittedRequestSummary &
  Readonly<{
    customerNotes: string;
    items: readonly Readonly<{
      configuration: Record<string, unknown>;
      customerNotes: string;
      id: string;
      productName: string;
      sequence: number;
    }>[];
  }>;

export class CustomerProjectService {
  async createProject(
    transaction: ActorScopedTransaction,
    input: Readonly<{ customerNotes?: string | undefined; projectName: string }>,
  ): Promise<CustomerProjectSummary> {
    const actor = customerActor(transaction);
    const parsed = createProjectSchema.parse(input);
    const id = randomUUID();
    const result = await transaction.query<
      QueryResultRow & {
        created_at: Date;
        id: string;
        project_name: string;
        record_version: number;
        state: string;
      }
    >(
      `insert into projects.customer_projects
         (id, customer_id, project_name, customer_notes)
       values ($1, $2, $3, $4)
       returning id, project_name, state, created_at, record_version`,
      [id, actor.customerId, parsed.projectName, parsed.customerNotes],
    );
    const row = result.rows[0];
    if (!row) throw new Error('PROJECT_CREATE_FAILED');
    return Object.freeze({
      createdAt: row.created_at.toISOString(),
      id: row.id,
      itemCount: 0,
      name: row.project_name,
      state: row.state,
      version: row.record_version,
    });
  }

  async addItem(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      customerNotes?: string | undefined;
      dimensions?: Record<string, number | string> | undefined;
      productId: string;
      projectId: string;
      selections?: Record<string, string | string[]> | undefined;
    }>,
  ): Promise<Readonly<{ itemId: string; position: number }>> {
    customerActor(transaction);
    const parsed = addItemSchema.parse(input);
    const product = await transaction.query<
      QueryResultRow & { lifecycle: string; record_version: number }
    >(
      `select lifecycle, record_version from catalog.products
       where id = $1 and lifecycle = 'PUBLISHED'`,
      [parsed.productId],
    );
    const productRow = product.rows[0];
    if (!productRow) throw new Error('PRODUCT_NOT_AVAILABLE');

    const project = await transaction.query<QueryResultRow & { id: string }>(
      `select id from projects.customer_projects
       where id = $1 and state = 'DRAFT' for update`,
      [parsed.projectId],
    );
    if (!project.rows[0]) throw new Error('PROJECT_NOT_EDITABLE');

    const next = await transaction.query<QueryResultRow & { position: number }>(
      `select coalesce(max(position), 0)::integer + 1 as position
       from projects.project_items where project_id = $1`,
      [parsed.projectId],
    );
    const position = next.rows[0]?.position ?? 1;
    const itemId = randomUUID();
    await transaction.query(
      `insert into projects.project_items
         (id, project_id, product_id, position, customer_notes)
       values ($1, $2, $3, $4, $5)`,
      [itemId, parsed.projectId, parsed.productId, position, parsed.customerNotes],
    );
    await transaction.query(
      `insert into projects.product_configurations
         (id, project_item_id, product_id, selections, dimensions, catalog_record_version)
       values ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [
        randomUUID(),
        itemId,
        parsed.productId,
        JSON.stringify(parsed.selections),
        JSON.stringify(parsed.dimensions),
        productRow.record_version,
      ],
    );
    return Object.freeze({ itemId, position });
  }

  async submitProject(
    transaction: ActorScopedTransaction,
    projectId: string,
  ): Promise<Readonly<{ requestId: string }>> {
    const actor = customerActor(transaction);
    const project = await transaction.query<
      QueryResultRow & { customer_notes: string; project_name: string; state: string }
    >(
      `select project_name, customer_notes, state
       from projects.customer_projects
       where id = $1 and customer_id = $2
       for update`,
      [projectId, actor.customerId],
    );
    const projectRow = project.rows[0];
    if (!projectRow || projectRow.state !== 'DRAFT') throw new Error('PROJECT_NOT_EDITABLE');

    const items = await transaction.query<
      QueryResultRow & {
        configuration: Record<string, unknown>;
        customer_notes: string;
        item_id: string;
        position: number;
        product_id: string;
        product_snapshot: Record<string, unknown>;
      }
    >(
      `select i.id as item_id, i.product_id, i.position, i.customer_notes,
              jsonb_build_object(
                'productId', p.id,
                'furnitureType', p.furniture_type,
                'name', coalesce(t.content_json ->> 'name', 'تصميم مخصص'),
                'description', coalesce(t.content_json ->> 'description', ''),
                'productionInformation', coalesce(p.production_information, ''),
                'catalogRecordVersion', p.record_version,
                'translationRevisionId', t.id
              ) as product_snapshot,
              jsonb_build_object(
                'schemaVersion', c.schema_version,
                'selections', c.selections,
                'dimensions', c.dimensions,
                'catalogRecordVersion', c.catalog_record_version
              ) as configuration
       from projects.project_items i
       join projects.product_configurations c on c.project_item_id = i.id
       join catalog.products p on p.id = i.product_id and p.lifecycle = 'PUBLISHED'
       join cms.localized_resources r on r.id = p.localized_resource_id
       join cms.translation_revisions t on t.id = r.current_ar_revision_id
         and t.lifecycle = 'PUBLISHED' and not t.stale_source
       where i.project_id = $1
       order by i.position`,
      [projectId],
    );
    if (items.rows.length === 0) throw new Error('PROJECT_REQUIRES_ITEM');

    const requestId = randomUUID();
    await transaction.query(
      `insert into projects.submitted_requests
         (id, source_project_id, customer_id, project_name_snapshot, customer_notes_snapshot)
       values ($1, $2, $3, $4, $5)`,
      [requestId, projectId, actor.customerId, projectRow.project_name, projectRow.customer_notes],
    );
    for (const item of items.rows) {
      await transaction.query(
        `insert into projects.submitted_request_items
           (id, request_id, source_project_item_id, sequence, product_id,
            product_snapshot, configuration_snapshot, customer_notes_snapshot)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)`,
        [
          randomUUID(),
          requestId,
          item.item_id,
          item.position,
          item.product_id,
          JSON.stringify(item.product_snapshot),
          JSON.stringify(item.configuration),
          item.customer_notes,
        ],
      );
    }
    await transaction.query(
      `update projects.customer_projects
       set state = 'SUBMITTED', submitted_at = clock_timestamp(),
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1`,
      [projectId],
    );
    await transaction.query(
      `insert into messaging.conversations (id, customer_id)
       values ($1, $2) on conflict (customer_id) do nothing`,
      [randomUUID(), actor.customerId],
    );
    await transaction.query(
      `insert into notifications.notifications
         (recipient_principal_id, event_type, resource_type, resource_id,
          title_ar, body_ar, event_key)
       select m.principal_id, 'REQUEST_SUBMITTED', 'REQUEST', $1,
              'طلب تصميم جديد', $2, $3
       from iam.managers m where m.is_active
       on conflict (recipient_principal_id, event_key) do nothing`,
      [requestId, `تم استلام طلب ${projectRow.project_name}.`, `request:${requestId}:submitted`],
    );
    return Object.freeze({ requestId });
  }

  async listCustomerProjects(
    transaction: ActorScopedTransaction,
  ): Promise<readonly CustomerProjectSummary[]> {
    customerActor(transaction);
    const result = await transaction.query<
      QueryResultRow & {
        created_at: Date;
        id: string;
        item_count: number;
        project_name: string;
        record_version: number;
        state: string;
      }
    >(
      `select p.id, p.project_name, p.state, p.created_at, p.record_version,
              count(i.id)::integer as item_count
       from projects.customer_projects p
       left join projects.project_items i on i.project_id = p.id
       group by p.id
       order by p.created_at desc`,
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          createdAt: row.created_at.toISOString(),
          id: row.id,
          itemCount: row.item_count,
          name: row.project_name,
          state: row.state,
          version: row.record_version,
        }),
      ),
    );
  }

  async getManagerRequest(
    transaction: ActorScopedTransaction,
    requestId: string,
  ): Promise<SubmittedRequestDetail | undefined> {
    managerActor(transaction);
    const request = await transaction.query<
      QueryResultRow & {
        customer_id: string;
        customer_label: string;
        customer_notes_snapshot: string;
        id: string;
        project_id: string;
        project_name_snapshot: string;
        state: string;
        submitted_at: Date;
      }
    >(
      `select r.id, r.source_project_id as project_id, r.customer_id, r.state,
              r.project_name_snapshot, r.customer_notes_snapshot, r.submitted_at,
              coalesce(c.contact_email, c.verified_email_snapshot, 'عميل') as customer_label
       from projects.submitted_requests r
       join iam.customers c on c.id = r.customer_id
       where r.id = $1`,
      [requestId],
    );
    const row = request.rows[0];
    if (!row) return undefined;

    const items = await transaction.query<
      QueryResultRow & {
        configuration_snapshot: Record<string, unknown>;
        customer_notes_snapshot: string;
        id: string;
        product_snapshot: Record<string, unknown>;
        sequence: number;
      }
    >(
      `select id, sequence, product_snapshot, configuration_snapshot,
              customer_notes_snapshot
       from projects.submitted_request_items
       where request_id = $1
       order by sequence`,
      [requestId],
    );

    return Object.freeze({
      customerId: row.customer_id,
      customerLabel: row.customer_label,
      customerNotes: row.customer_notes_snapshot,
      id: row.id,
      itemCount: items.rows.length,
      items: Object.freeze(
        items.rows.map((item) =>
          Object.freeze({
            configuration: item.configuration_snapshot,
            customerNotes: item.customer_notes_snapshot,
            id: item.id,
            productName:
              typeof item.product_snapshot.name === 'string'
                ? item.product_snapshot.name
                : 'تصميم مخصص',
            sequence: item.sequence,
          }),
        ),
      ),
      projectId: row.project_id,
      projectName: row.project_name_snapshot,
      state: row.state,
      submittedAt: row.submitted_at.toISOString(),
    });
  }

  async listManagerRequests(
    transaction: ActorScopedTransaction,
  ): Promise<readonly SubmittedRequestSummary[]> {
    managerActor(transaction);
    const result = await transaction.query<
      QueryResultRow & {
        customer_id: string;
        customer_label: string;
        id: string;
        item_count: number;
        project_id: string;
        project_name_snapshot: string;
        state: string;
        submitted_at: Date;
      }
    >(
      `select r.id, r.source_project_id as project_id, r.customer_id, r.state,
              r.project_name_snapshot, r.submitted_at,
              coalesce(c.contact_email, c.verified_email_snapshot, 'عميل') as customer_label,
              count(i.id)::integer as item_count
       from projects.submitted_requests r
       join iam.customers c on c.id = r.customer_id
       left join projects.submitted_request_items i on i.request_id = r.id
       group by r.id, c.contact_email, c.verified_email_snapshot
       order by r.submitted_at desc`,
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          customerId: row.customer_id,
          customerLabel: row.customer_label,
          id: row.id,
          itemCount: row.item_count,
          projectId: row.project_id,
          projectName: row.project_name_snapshot,
          state: row.state,
          submittedAt: row.submitted_at.toISOString(),
        }),
      ),
    );
  }
}
