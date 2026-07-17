import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { normalizeArabicCatalogSearchText } from '../../src/modules/catalog-and-search';
import { PostgresCatalogRepository } from '../../src/modules/catalog-and-search/infrastructure/postgres/catalog-repository';
import { withActorTransaction } from '../../src/platform/database';
import { p1ActorContexts, p1FixtureIds, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

const ids = Object.freeze({
  category: '51000000-0000-4000-8000-000000000001',
  categoryResource: '52000000-0000-4000-8000-000000000001',
  collection: '53000000-0000-4000-8000-000000000001',
  collectionResource: '54000000-0000-4000-8000-000000000001',
  hiddenProduct: '55000000-0000-4000-8000-000000000002',
  hiddenProductResource: '56000000-0000-4000-8000-000000000002',
  product: '55000000-0000-4000-8000-000000000001',
  productResource: '56000000-0000-4000-8000-000000000001',
  productTranslation: '57000000-0000-4000-8000-000000000001',
});

describe('PostgreSQL Catalog publication, search, and query plans', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;
  const repository = new PostgresCatalogRepository();

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('catalog_search');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    pool = new Pool({ connectionString: database.connectionString });

    await owner.query(
      `insert into cms.localized_resources
         (id, resource_type, created_by_principal_id)
       values
         ($1, 'CATEGORY', $5), ($2, 'COLLECTION', $5),
         ($3, 'PRODUCT', $5), ($4, 'PRODUCT', $5)`,
      [
        ids.categoryResource,
        ids.collectionResource,
        ids.productResource,
        ids.hiddenProductResource,
        p1FixtureIds.managerPrincipal,
      ],
    );
    await owner.query(
      `insert into cms.translation_revisions
         (id, resource_id, locale, revision_number, lifecycle, content_schema_version,
          content_json, stale_source, content_digest, authored_by_principal_id,
          reviewed_by_principal_id, approved_by_principal_id, published_by_principal_id,
          reviewed_at, approved_at, published_at)
       values
         ($1, $2, 'ar', 1, 'PUBLISHED', 1,
          '{"name":"أَثــاث إسلامي","description":"كرسي عربي حديث"}'::jsonb,
          false, $3, $4, $4, $4, $4,
          clock_timestamp(), clock_timestamp(), clock_timestamp())`,
      [ids.productTranslation, ids.productResource, 'a'.repeat(64), p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `update cms.localized_resources set current_ar_revision_id = $2
       where id = $1`,
      [ids.productResource, ids.productTranslation],
    );
    await owner.query(
      `insert into catalog.categories
         (id, localized_resource_id, lifecycle, created_by_principal_id,
          updated_by_principal_id)
       values ($1, $2, 'PUBLISHED', $3, $3)`,
      [ids.category, ids.categoryResource, p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `insert into catalog.collections
         (id, localized_resource_id, lifecycle, created_by_principal_id,
          updated_by_principal_id)
       values ($1, $2, 'PUBLISHED', $3, $3)`,
      [ids.collection, ids.collectionResource, p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `insert into catalog.products
         (id, localized_resource_id, category_id, furniture_type, lifecycle,
          starting_amount_minor, currency_code, created_by_principal_id,
          updated_by_principal_id, published_at)
       values
         ($1, $2, $3, 'DINING_CHAIR', 'PUBLISHED', 10000, 'SAR', $4, $4,
          clock_timestamp()),
         ($5, $6, $3, 'HIDDEN_CHAIR', 'HIDDEN', 9000, 'SAR', $4, $4, null)`,
      [
        ids.product,
        ids.productResource,
        ids.category,
        p1FixtureIds.managerPrincipal,
        ids.hiddenProduct,
        ids.hiddenProductResource,
      ],
    );
    await owner.query(
      `insert into catalog.product_collections(product_id, collection_id)
       values ($1, $2)`,
      [ids.product, ids.collection],
    );
    await owner.query(
      `insert into catalog.search_documents
         (product_id, locale, source_translation_revision_id, name, description,
          normalized_text, published_at)
       select $1, 'ar', $2, 'أَثــاث إسلامي', 'كرسي عربي حديث',
              catalog.normalize_arabic_search('أَثــاث إسلامي كرسي عربي حديث'),
              published_at
       from cms.translation_revisions where id = $2`,
      [ids.product, ids.productTranslation],
    );
  });

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  it('keeps TypeScript and PostgreSQL Arabic normalization identical', async () => {
    const candidate = ' أَثــاث، إسلامي ومِئَة ومُؤسسة ';
    const result = await owner.query<{ normalized: string }>(
      `select catalog.normalize_arabic_search($1) as normalized`,
      [candidate],
    );
    expect(result.rows[0]?.normalized).toBe(normalizeArabicCatalogSearchText(candidate));
  });

  it('returns ranked published Arabic results and treats hostile input as data', async () => {
    const results = await withActorTransaction(pool, p1ActorContexts.visitor, (transaction) =>
      repository.search(transaction, {
        limit: 12,
        locale: 'ar',
        normalizedQuery: normalizeArabicCatalogSearchText('اثاث'),
      }),
    );
    expect(results.hits).toEqual([
      expect.objectContaining({ locale: 'ar', name: 'أَثــاث إسلامي', productId: ids.product }),
    ]);

    await expect(
      withActorTransaction(pool, p1ActorContexts.visitor, (transaction) =>
        repository.search(transaction, {
          limit: 12,
          locale: 'ar',
          normalizedQuery: `x' OR true; --`,
        }),
      ),
    ).resolves.toEqual({ hasMore: false, hits: [] });
  });

  it('exposes only PUBLISHED Products through visitor RLS and repository filters', async () => {
    const page = await withActorTransaction(pool, p1ActorContexts.visitor, (transaction) =>
      repository.listPublicProducts(transaction, { limit: 12 }),
    );
    expect(page.items.map((item) => item.id)).toEqual([ids.product]);
    const hiddenCount = await withActorTransaction(
      pool,
      p1ActorContexts.visitor,
      async (transaction) => {
        const result = await transaction.query<{ count: number }>(
          `select count(*)::integer as count from catalog.products where id = $1`,
          [ids.hiddenProduct],
        );
        return result.rows[0]?.count;
      },
    );
    expect(hiddenCount).toBe(0);
  });

  it('has indexed full-text and trigram access paths for the search projection', async () => {
    await owner.query('set enable_seqscan = off');
    const fullText = await owner.query<{ 'QUERY PLAN': string }>(
      `explain (costs off)
       select product_id from catalog.search_documents
       where search_vector @@ plainto_tsquery('simple', $1)`,
      ['اثاث'],
    );
    const trigram = await owner.query<{ 'QUERY PLAN': string }>(
      `explain (costs off)
       select product_id from catalog.search_documents
       where normalized_text OPERATOR(extensions.%) $1`,
      ['اثاث'],
    );
    expect(fullText.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(
      'search_documents_vector_idx',
    );
    expect(trigram.rows.map((row) => row['QUERY PLAN']).join('\n')).toContain(
      'search_documents_trgm_idx',
    );
  });
});
