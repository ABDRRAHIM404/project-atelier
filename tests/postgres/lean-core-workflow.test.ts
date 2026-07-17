import { Client, Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { CustomerProjectService } from '../../src/modules/customer-projects';
import { FulfilmentService } from '../../src/modules/fulfilment';
import { OrderQueryService } from '../../src/modules/orders';
import { PaymentService } from '../../src/modules/payments';
import { ProductionService } from '../../src/modules/production';
import { QuotationService } from '../../src/modules/quotations-and-acceptance';
import { withActorTransaction } from '../../src/platform/database';
import { ManagerCatalogService } from '../../src/platform/workflow/manager-catalog';
import { p1ActorContexts, p1FixtureIds, seedP1IdentityFixtures } from '../fixtures/p1-database';
import {
  createIsolatedPostgresDatabase,
  type IsolatedPostgresDatabase,
} from '../support/postgres-test-database';

const ids = Object.freeze({
  category: '81000000-0000-4000-8000-000000000001',
  categoryResource: '82000000-0000-4000-8000-000000000001',
  product: '83000000-0000-4000-8000-000000000001',
  productResource: '84000000-0000-4000-8000-000000000001',
  productTranslation: '85000000-0000-4000-8000-000000000001',
});

describe('lean V1 commercial workflow', () => {
  let database: IsolatedPostgresDatabase;
  let owner: Client;
  let pool: Pool;

  beforeAll(async () => {
    database = await createIsolatedPostgresDatabase('lean_core_workflow');
    owner = new Client({ connectionString: database.connectionString });
    await owner.connect();
    await seedP1IdentityFixtures(owner);
    pool = new Pool({ connectionString: database.connectionString });

    await owner.query(
      `insert into cms.localized_resources
         (id, resource_type, created_by_principal_id)
       values ($1, 'CATEGORY', $3), ($2, 'PRODUCT', $3)`,
      [ids.categoryResource, ids.productResource, p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `insert into cms.translation_revisions
         (id, resource_id, locale, revision_number, lifecycle, content_schema_version,
          content_json, stale_source, content_digest, authored_by_principal_id,
          reviewed_by_principal_id, approved_by_principal_id, published_by_principal_id,
          reviewed_at, approved_at, published_at)
       values ($1, $2, 'ar', 1, 'PUBLISHED', 1,
               '{"name":"كنبة اختبار","description":"تصميم مخصص للاختبار"}'::jsonb,
               false, $3, $4, $4, $4, $4,
               clock_timestamp(), clock_timestamp(), clock_timestamp())`,
      [ids.productTranslation, ids.productResource, 'a'.repeat(64), p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `update cms.localized_resources set current_ar_revision_id = $2 where id = $1`,
      [ids.productResource, ids.productTranslation],
    );
    await owner.query(
      `insert into catalog.categories
         (id, localized_resource_id, lifecycle, created_by_principal_id, updated_by_principal_id)
       values ($1, $2, 'PUBLISHED', $3, $3)`,
      [ids.category, ids.categoryResource, p1FixtureIds.managerPrincipal],
    );
    await owner.query(
      `insert into catalog.products
         (id, localized_resource_id, category_id, furniture_type, lifecycle,
          starting_amount_minor, currency_code, production_information,
          created_by_principal_id, updated_by_principal_id, published_at)
       values ($1, $2, $3, 'SOFA', 'PUBLISHED', 0, 'SAR', 'بعد اعتماد المقاسات',
               $4, $4, clock_timestamp())`,
      [ids.product, ids.productResource, ids.category, p1FixtureIds.managerPrincipal],
    );
  });

  afterAll(async () => {
    await pool?.end();
    await owner?.end();
    await database?.dispose();
  });

  it('completes request, quotation, manual payment, production and handoff atomically', async () => {
    const projects = new CustomerProjectService();
    const quotations = new QuotationService();
    const payments = new PaymentService();
    const production = new ProductionService();
    const fulfilment = new FulfilmentService();
    const orders = new OrderQueryService();

    const project = await withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
      projects.createProject(transaction, { projectName: 'مجلس العائلة' }),
    );
    const item = await withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
      projects.addItem(transaction, {
        dimensions: { width: 320 },
        productId: ids.product,
        projectId: project.id,
        selections: { fabric: 'beige' },
      }),
    );
    expect(item.position).toBe(1);

    const submitted = await withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
      projects.submitProject(transaction, project.id),
    );
    const managerRequests = await withActorTransaction(
      pool,
      p1ActorContexts.managerMfa,
      (transaction) => projects.listManagerRequests(transaction),
    );
    expect(managerRequests).toEqual([
      expect.objectContaining({ id: submitted.requestId, itemCount: 1, state: 'SUBMITTED' }),
    ]);

    const customerBProjects = await withActorTransaction(
      pool,
      p1ActorContexts.customerB,
      (transaction) => projects.listCustomerProjects(transaction),
    );
    expect(customerBProjects).toEqual([]);

    const submittedItems = await owner.query<{ id: string }>(
      `select id from projects.submitted_request_items where request_id = $1`,
      [submitted.requestId],
    );
    const submittedItemId = submittedItems.rows[0]?.id;
    expect(submittedItemId).toBeTruthy();

    const quote = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      quotations.createAndSend(transaction, {
        deliveryMinor: 25000,
        fulfilmentMethod: 'DELIVERY',
        fulfilmentSnapshot: { city: 'الرياض', address: 'حي نموذجي' },
        lines: [{ itemTotalMinor: 450000, submittedItemId: submittedItemId! }],
        productionEstimateText: 'من 20 إلى 30 يوم عمل',
        requestId: submitted.requestId,
        termsSnapshot: { payment: 'تحويل بنكي كامل قبل بدء التنفيذ' },
      }),
    );
    expect(quote.totalMinor).toBe(475000);

    const accepted = await withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
      quotations.accept(transaction, quote.revisionId),
    );
    await expect(
      withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
        production.transition(transaction, {
          orderId: accepted.orderId,
          toState: 'MATERIALS_PREPARATION',
        }),
      ),
    ).rejects.toThrow('verified Payment is required before Production');

    await expect(
      withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
        payments.submitProof(transaction, {
          orderId: accepted.orderId,
          proofDisplayFilename: 'bank-transfer.pdf',
          proofMediaType: 'application/pdf',
          proofObjectKey: `private/payment-proofs/${accepted.orderId}/bank-transfer.pdf`,
        }),
      ),
    ).rejects.toThrow('FULFILMENT_DETAILS_REQUIRED');

    await withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
      fulfilment.confirmCustomerDetails(transaction, {
        address: 'شارع الملك فهد، مبنى 12',
        city: 'الرياض',
        deliveryNotes: 'الاتصال قبل الوصول',
        district: 'النخيل',
        mapUrl: 'https://maps.google.com/?q=24.7,46.7',
        method: 'DELIVERY',
        orderId: accepted.orderId,
        phoneNumber: '0500000000',
      }),
    );

    const payment = await withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
      payments.submitProof(transaction, {
        orderId: accepted.orderId,
        proofChecksumSha256: 'b'.repeat(64),
        proofDisplayFilename: 'bank-transfer.pdf',
        proofMediaType: 'application/pdf',
        proofObjectKey: `private/payment-proofs/${accepted.orderId}/bank-transfer.pdf`,
      }),
    );
    await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      payments.decide(transaction, { outcome: 'VERIFIED', submissionId: payment.submissionId }),
    );

    for (const toState of [
      'MATERIALS_PREPARATION',
      'IN_PRODUCTION',
      'QUALITY_INSPECTION',
      'READY',
    ] as const) {
      await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
        production.transition(transaction, {
          customerVisibleNote: `انتقل إلى ${toState}`,
          orderId: accepted.orderId,
          toState,
        }),
      );
    }

    await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      fulfilment.complete(transaction, {
        orderId: accepted.orderId,
        proofChecksumSha256: 'c'.repeat(64),
        proofDisplayFilename: 'handoff.jpg',
        proofMediaType: 'image/jpeg',
        proofObjectKey: `private/handoff/${accepted.orderId}/handoff.jpg`,
      }),
    );

    const detail = await withActorTransaction(pool, p1ActorContexts.customerA, (transaction) =>
      orders.get(transaction, accepted.orderId),
    );
    expect(detail).toMatchObject({
      displayReference: accepted.orderReference,
      fulfilmentDetails: expect.objectContaining({
        address: 'شارع الملك فهد، مبنى 12',
        city: 'الرياض',
        district: 'النخيل',
        phoneNumber: '0500000000',
      }),
      fulfilmentState: 'COMPLETED',
      lifecycleState: 'COMPLETED',
      paymentState: 'VERIFIED',
      productionState: 'READY',
      totalMinor: 475000,
    });
    expect(detail?.items).toHaveLength(1);
    expect(detail?.productionUpdates).toHaveLength(4);
  });

  it('lets the manager create and revise Arabic catalog drafts without publishing them', async () => {
    const catalog = new ManagerCatalogService();
    const created = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      catalog.createDraft(transaction, {
        description: 'طاولة مخصصة يمكن تعديل مقاسها وتشطيبها قبل اعتماد عرض السعر.',
        furnitureType: 'DINING_TABLE',
        name: 'طاولة مسودة',
        productionInformation: 'يحدد الموعد بعد اعتماد المقاسات.',
        startingAmountMinor: 125000,
      }),
    );
    expect(created).toMatchObject({ lifecycle: 'DRAFT', name: 'طاولة مسودة', recordVersion: 1 });

    const updated = await withActorTransaction(pool, p1ActorContexts.managerMfa, (transaction) =>
      catalog.updateDraft(transaction, {
        description: 'طاولة مخصصة للعائلة مع خيارات للمقاس والخامة والتشطيب النهائي.',
        expectedVersion: created.recordVersion,
        furnitureType: 'DINING_TABLE',
        name: 'طاولة لمة مسودة',
        productId: created.id,
        productionInformation: 'يحدد الموعد بعد اعتماد المقاسات والخامة.',
        startingAmountMinor: 135000,
      }),
    );
    expect(updated).toMatchObject({
      lifecycle: 'DRAFT',
      name: 'طاولة لمة مسودة',
      recordVersion: 2,
      startingAmountMinor: 135000,
    });

    const publicRow = await owner.query<{ count: string }>(
      `select count(*)::text as count from catalog.products
       where id = $1 and lifecycle = 'PUBLISHED'`,
      [created.id],
    );
    expect(publicRow.rows[0]?.count).toBe('0');
  });

  it('keeps submitted and accepted commercial snapshots immutable', async () => {
    const snapshots = await owner.query<{ id: string }>(
      `select id from projects.submitted_request_items limit 1`,
    );
    await expect(
      owner.query(
        `update projects.submitted_request_items
         set customer_notes_snapshot = 'tampered' where id = $1`,
        [snapshots.rows[0]?.id],
      ),
    ).rejects.toMatchObject({ code: '55000' });

    const orders = await owner.query<{ id: string }>(
      `select id from orders.order_item_snapshots limit 1`,
    );
    await expect(
      owner.query(`update orders.order_item_snapshots set item_total_minor = 1 where id = $1`, [
        orders.rows[0]?.id,
      ]),
    ).rejects.toMatchObject({ code: '55000' });
  });
});
