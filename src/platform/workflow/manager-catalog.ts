import { createHash, randomUUID } from 'node:crypto';

import type { QueryResultRow } from 'pg';
import { z } from 'zod';

import { AuditRecorder } from '../../modules/audit-and-operations';
import { PostgresAuditAndOperationsRepository } from '../../modules/audit-and-operations/infrastructure/postgres/repositories';
import type { ActorScopedTransaction } from '../database';
import { createCorrelationId } from '../observability';
import { utcInstantFromDate } from '../../shared/kernel';

const furnitureTypes = [
  'SOFA',
  'BED',
  'DINING_TABLE',
  'WARDROBE',
  'TV_UNIT',
  'SHELF',
  'DESK',
  'CHAIR',
  'OTHER',
] as const;

const productDraftSchema = z.object({
  description: z.string().trim().min(10).max(2_000),
  furnitureType: z.enum(furnitureTypes),
  name: z.string().trim().min(2).max(120),
  productionInformation: z.string().trim().max(1_000).default(''),
  startingAmountMinor: z.number().int().min(0).max(100_000_000),
});

const updateDraftSchema = productDraftSchema.extend({
  expectedVersion: z.number().int().min(1),
  productId: z.uuid(),
});

type CatalogProductRow = QueryResultRow & {
  content_json: unknown;
  furniture_type: string;
  id: string;
  lifecycle: string;
  production_information: string | null;
  record_version: number;
  starting_amount_minor: string;
};

export type ManagerCatalogProduct = Readonly<{
  description: string;
  furnitureType: string;
  id: string;
  lifecycle: string;
  name: string;
  productionInformation: string;
  recordVersion: number;
  startingAmountMinor: number;
}>;

function managerPrincipal(transaction: ActorScopedTransaction): string {
  const context = transaction.actorContext;
  if (context.actor.kind !== 'manager' || context.assurance !== 'manager_mfa') {
    throw new Error('MANAGER_MFA_REQUIRED');
  }
  return context.actor.principalId;
}

function contentText(value: unknown, key: 'description' | 'name'): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === 'string' ? candidate : '';
}

function productFromRow(row: CatalogProductRow): ManagerCatalogProduct {
  const amount = Number(row.starting_amount_minor);
  if (!Number.isSafeInteger(amount)) throw new Error('CATALOG_PRICE_INVALID');
  return Object.freeze({
    description: contentText(row.content_json, 'description'),
    furnitureType: row.furniture_type,
    id: row.id,
    lifecycle: row.lifecycle,
    name: contentText(row.content_json, 'name') || 'مسودة بدون اسم',
    productionInformation: row.production_information ?? '',
    recordVersion: row.record_version,
    startingAmountMinor: amount,
  });
}

function now() {
  const parsed = utcInstantFromDate(new Date());
  if (!parsed.ok) throw new Error('WORKFLOW_TIME_INVALID');
  return parsed.value;
}

const audit = new AuditRecorder(new PostgresAuditAndOperationsRepository());

export class ManagerCatalogService {
  async list(transaction: ActorScopedTransaction): Promise<readonly ManagerCatalogProduct[]> {
    managerPrincipal(transaction);
    const result = await transaction.query<CatalogProductRow>(
      `select p.id, p.furniture_type, p.lifecycle, p.starting_amount_minor,
              p.production_information, p.record_version,
              coalesce(t.content_json, '{}'::jsonb) as content_json
       from catalog.products p
       left join lateral (
         select tr.content_json
         from cms.translation_revisions tr
         where tr.resource_id = p.localized_resource_id and tr.locale = 'ar'
         order by tr.revision_number desc
         limit 1
       ) t on true
       order by p.updated_at desc, p.id`,
    );
    return Object.freeze(result.rows.map(productFromRow));
  }

  async createDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      description: string;
      furnitureType: string;
      name: string;
      productionInformation?: string;
      startingAmountMinor: number;
    }>,
  ): Promise<ManagerCatalogProduct> {
    const principalId = managerPrincipal(transaction);
    const parsed = productDraftSchema.parse(input);
    const category = await transaction.query<{ id: string }>(
      `select id from catalog.categories
       order by (lifecycle = 'PUBLISHED') desc, sort_order, created_at, id
       limit 1`,
    );
    const categoryId = category.rows[0]?.id;
    if (!categoryId) throw new Error('CATALOG_CATEGORY_MISSING');

    const productId = randomUUID();
    const resourceId = randomUUID();
    const translationId = randomUUID();
    const content = Object.freeze({ description: parsed.description, name: parsed.name });
    const digest = createHash('sha256').update(JSON.stringify(content)).digest('hex');

    await transaction.query(
      `insert into cms.localized_resources
         (id, resource_type, created_by_principal_id)
       values ($1, 'PRODUCT', $2)`,
      [resourceId, principalId],
    );
    await transaction.query(
      `insert into cms.translation_revisions
         (id, resource_id, locale, revision_number, lifecycle, content_schema_version,
          content_json, stale_source, content_digest, authored_by_principal_id)
       values ($1, $2, 'ar', 1, 'DRAFT', 1, $3::jsonb, false, $4, $5)`,
      [translationId, resourceId, JSON.stringify(content), digest, principalId],
    );
    const inserted = await transaction.query<CatalogProductRow>(
      `insert into catalog.products
         (id, localized_resource_id, category_id, furniture_type,
          starting_amount_minor, currency_code, production_information,
          created_by_principal_id, updated_by_principal_id)
       values ($1, $2, $3, $4, $5, 'SAR', $6, $7, $7)
       returning id, furniture_type, lifecycle, starting_amount_minor,
                 production_information, record_version, $8::jsonb as content_json`,
      [
        productId,
        resourceId,
        categoryId,
        parsed.furnitureType,
        parsed.startingAmountMinor,
        parsed.productionInformation || null,
        principalId,
        JSON.stringify(content),
      ],
    );
    const product = inserted.rows[0];
    if (!product) throw new Error('CATALOG_CREATE_FAILED');
    await audit.record(transaction, {
      correlationId: createCorrelationId(),
      eventType: 'CATALOG_PRODUCT_CREATED',
      occurredAt: now(),
      operation: 'CREATE_CATALOG_PRODUCT',
      outcome: 'SUCCEEDED',
      stateAfter: 'DRAFT',
      targetId: productId,
      targetType: 'CatalogProduct',
    });
    return productFromRow(product);
  }

  async publishDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      productId: string;
    }>,
  ): Promise<ManagerCatalogProduct> {
    const principalId = managerPrincipal(transaction);
    const current = await transaction.query<
      QueryResultRow & { lifecycle: string; localized_resource_id: string; record_version: number }
    >(
      `select localized_resource_id, lifecycle, record_version
       from catalog.products where id = $1 for update`,
      [input.productId],
    );
    const product = current.rows[0];
    if (!product) throw new Error('RESOURCE_NOT_FOUND');
    if (product.lifecycle !== 'DRAFT') throw new Error('CATALOG_PRODUCT_NOT_DRAFT');

    const translation = await transaction.query<
      QueryResultRow & {
        authored_by_principal_id: string;
        content_digest: string;
        content_json: unknown;
        content_schema_version: number;
        id: string;
        revision_number: number;
      }
    >(
      `select id, revision_number, content_schema_version, content_json, content_digest, authored_by_principal_id
       from cms.translation_revisions
       where resource_id = $1 and locale = 'ar' and lifecycle = 'DRAFT'
       order by revision_number desc
       limit 1
       for update`,
      [product.localized_resource_id],
    );
    const draft = translation.rows[0];
    if (!draft) throw new Error('CATALOG_TRANSLATION_NOT_DRAFT');

    const timestamp = new Date();
    const publishedTranslation = await transaction.query<{ id: string }>(
      `insert into cms.translation_revisions
         (resource_id, locale, revision_number, lifecycle, content_schema_version,
          content_json, source_arabic_revision_id, prior_revision_id, stale_source,
          content_digest, authored_by_principal_id, reviewed_by_principal_id,
          approved_by_principal_id, published_by_principal_id, reviewed_at, approved_at, published_at)
       values ($1, 'ar', $2, 'PUBLISHED', $3, $4::jsonb, null, $5, false, $6, $7, $8, $8, $8, $9, $9, $9)
       returning id`,
      [
        product.localized_resource_id,
        draft.revision_number + 1,
        draft.content_schema_version,
        JSON.stringify(draft.content_json),
        draft.id,
        draft.content_digest,
        draft.authored_by_principal_id,
        principalId,
        timestamp,
      ],
    );
    const publishedTranslationId = publishedTranslation.rows[0]?.id;
    if (!publishedTranslationId) throw new Error('CATALOG_PUBLISH_FAILED');

    await transaction.query(
      `update cms.localized_resources
       set current_ar_revision_id = $2,
           record_version = record_version + 1
       where id = $1`,
      [product.localized_resource_id, publishedTranslationId],
    );

    const published = await transaction.query<CatalogProductRow>(
      `update catalog.products
       set lifecycle = 'PUBLISHED', published_at = coalesce(published_at, clock_timestamp()),
           updated_by_principal_id = $2, updated_at = clock_timestamp(),
           record_version = record_version + 1
       where id = $1 and lifecycle = 'DRAFT'
       returning id, furniture_type, lifecycle, starting_amount_minor,
                 production_information, record_version, $3::jsonb as content_json`,
      [input.productId, principalId, JSON.stringify(draft.content_json)],
    );
    const row = published.rows[0];
    if (!row) throw new Error('CATALOG_PUBLISH_FAILED');

    await audit.record(transaction, {
      correlationId: createCorrelationId(),
      eventType: 'CATALOG_PRODUCT_PUBLISHED',
      occurredAt: now(),
      operation: 'PUBLISH_CATALOG_PRODUCT',
      outcome: 'SUCCEEDED',
      stateAfter: 'PUBLISHED',
      stateBefore: 'DRAFT',
      targetId: input.productId,
      targetType: 'CatalogProduct',
    });
    return productFromRow(row);
  }
  async updateDraft(
    transaction: ActorScopedTransaction,
    input: Readonly<{
      description: string;
      expectedVersion: number;
      furnitureType: string;
      name: string;
      productId: string;
      productionInformation?: string;
      startingAmountMinor: number;
    }>,
  ): Promise<ManagerCatalogProduct> {
    const principalId = managerPrincipal(transaction);
    const parsed = updateDraftSchema.parse(input);
    const current = await transaction.query<
      QueryResultRow & { lifecycle: string; localized_resource_id: string; record_version: number }
    >(
      `select localized_resource_id, lifecycle, record_version
       from catalog.products where id = $1 for update`,
      [parsed.productId],
    );
    const product = current.rows[0];
    if (!product) throw new Error('RESOURCE_NOT_FOUND');
    if (product.lifecycle !== 'DRAFT') throw new Error('CATALOG_PRODUCT_NOT_DRAFT');
    if (product.record_version !== parsed.expectedVersion) throw new Error('VERSION_CONFLICT');

    const translation = await transaction.query<{ id: string }>(
      `select t.id
       from cms.translation_revisions t
       where t.resource_id = $1 and t.locale = 'ar' and t.lifecycle = 'DRAFT'
       order by t.revision_number desc
       limit 1
       for update`,
      [product.localized_resource_id],
    );
    const translationId = translation.rows[0]?.id;
    if (!translationId) throw new Error('CATALOG_TRANSLATION_NOT_DRAFT');

    const content = Object.freeze({ description: parsed.description, name: parsed.name });
    const digest = createHash('sha256').update(JSON.stringify(content)).digest('hex');
    await transaction.query(
      `update cms.translation_revisions
       set content_json = $2::jsonb, content_digest = $3,
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1`,
      [translationId, JSON.stringify(content), digest],
    );
    const updated = await transaction.query<CatalogProductRow>(
      `update catalog.products
       set furniture_type = $2, starting_amount_minor = $3,
           production_information = $4, updated_by_principal_id = $5,
           updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1 and lifecycle = 'DRAFT' and record_version = $6
       returning id, furniture_type, lifecycle, starting_amount_minor,
                 production_information, record_version, $7::jsonb as content_json`,
      [
        parsed.productId,
        parsed.furnitureType,
        parsed.startingAmountMinor,
        parsed.productionInformation || null,
        principalId,
        parsed.expectedVersion,
        JSON.stringify(content),
      ],
    );
    const row = updated.rows[0];
    if (!row) throw new Error('VERSION_CONFLICT');
    await audit.record(transaction, {
      correlationId: createCorrelationId(),
      eventType: 'CATALOG_PRODUCT_UPDATED',
      metadata: {
        changed_fields: [
          'arabic_content',
          'furniture_type',
          'production_information',
          'starting_price',
        ],
      },
      occurredAt: now(),
      operation: 'UPDATE_CATALOG_PRODUCT',
      outcome: 'SUCCEEDED',
      stateAfter: 'DRAFT',
      stateBefore: 'DRAFT',
      targetId: parsed.productId,
      targetType: 'CatalogProduct',
    });
    return productFromRow(row);
  }
}
