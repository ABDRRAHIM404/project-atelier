import { describe, expect, it, vi } from 'vitest';

import type { ActorScopedTransaction } from '../../src/platform/database';
import {
  CatalogCommandService,
  CatalogQueryService,
  CatalogSearchProjectionService,
  type CatalogAuditPort,
  type CatalogInvalidationPort,
  type CatalogLocalizationReadPort,
  type CatalogPersistence,
  type CatalogPublicMediaReadPort,
} from '../../src/modules/catalog-and-search';
import {
  createMoney,
  parseCurrencyCode,
  parseIdentifier,
  parseRecordVersion,
  parseUtcInstant,
} from '../../src/shared/kernel';

const principal = parseIdentifier<'Principal'>('10000000-0000-4000-8000-000000000001');
const sar = parseCurrencyCode('SAR');
const occurredAt = parseUtcInstant('2026-07-16T12:00:00.000Z');
const recordVersion = parseRecordVersion(1);
if (!principal.ok || !sar.ok || !occurredAt.ok || !recordVersion.ok)
  throw new Error('Invalid Catalog fixtures.');
const money = createMoney(10000n, sar.value);
if (!money.ok) throw new Error('Invalid Catalog Money fixture.');

const manager = {
  actorContext: {
    actor: { kind: 'manager', principalId: principal.value },
    assurance: 'manager_mfa',
  },
} as ActorScopedTransaction;
const passwordOnly = {
  actorContext: {
    actor: { kind: 'manager', principalId: principal.value },
    assurance: 'manager_password',
  },
} as ActorScopedTransaction;
const systemJob = {
  actorContext: { actor: { kind: 'system_job' }, assurance: 'system_job' },
} as ActorScopedTransaction;

const productId = '20000000-0000-4000-8000-000000000001';
const localizedResourceId = '30000000-0000-4000-8000-000000000001';
const revisionId = '40000000-0000-4000-8000-000000000001';

function commandService(persistence: Partial<CatalogPersistence>) {
  const localization: CatalogLocalizationReadPort = {
    findPublicationCandidate: vi.fn(async () => ({
      humanApproved: true,
      locale: 'ar' as const,
      name: 'كرسي',
      revisionId,
      stale: false,
      state: 'PUBLISHED' as const,
    })),
    findPublished: vi.fn(),
  };
  const media: CatalogPublicMediaReadPort = {
    publicationReady: vi.fn(async () => ({ ready: true })),
  };
  const audit: CatalogAuditPort = { catalogChanged: vi.fn(async () => undefined) };
  const invalidation: CatalogInvalidationPort = {
    catalogChanged: vi.fn(async () => undefined),
  };
  return {
    audit,
    invalidation,
    service: new CatalogCommandService(
      persistence as CatalogPersistence,
      localization,
      media,
      audit,
      invalidation,
    ),
  };
}

describe('Catalog command authorization and publication closure', () => {
  it('requires Manager MFA before persistence', async () => {
    const createProductDraft = vi.fn();
    const { service } = commandService({ createProductDraft });
    await expect(
      service.createProductDraft(passwordOnly, {
        categoryId: '50000000-0000-4000-8000-000000000001',
        correlationId: '60000000-0000-4000-8000-000000000001',
        furnitureType: 'DINING_CHAIR',
        id: productId,
        localizedResourceId,
        occurredAt: occurredAt.value,
        startingPrice: money.value,
      }),
    ).resolves.toEqual({ error: { code: 'AUTH_ASSURANCE_REQUIRED' }, ok: false });
    expect(createProductDraft).not.toHaveBeenCalled();
  });

  it('publishes only with Product and dependent Arabic approval and records durable effects', async () => {
    const resource = {
      id: productId,
      kind: 'PRODUCT' as const,
      lifecycle: 'DRAFT' as const,
      localizedResourceId,
      recordVersion: 1,
    };
    const transitionResource = vi.fn(async () => ({
      ...resource,
      lifecycle: 'PUBLISHED' as const,
      recordVersion: 2,
    }));
    const { audit, invalidation, service } = commandService({
      findResourceForUpdate: vi.fn(async () => resource),
      publicationReadiness: vi.fn(async () => ({
        categoryPublished: true,
        configurationValid: true,
        dependentLocalizedResourceIds: ['30000000-0000-4000-8000-000000000002'],
        hasCollection: true,
      })),
      transitionResource,
    });
    const result = await service.publish(manager, {
      correlationId: '60000000-0000-4000-8000-000000000001',
      expectedVersion: 1,
      occurredAt: occurredAt.value,
      resourceId: productId,
      resourceKind: 'PRODUCT',
    });
    expect(result).toEqual({
      ok: true,
      value: { id: productId, lifecycle: 'PUBLISHED', version: 2 },
    });
    expect(transitionResource).toHaveBeenCalledOnce();
    expect(audit.catalogChanged).toHaveBeenCalledOnce();
    expect(invalidation.catalogChanged).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ eventType: 'CATALOG_PUBLICATION_CHANGED', revision: 2 }),
    );
  });

  it('keeps unresolved archive policy disabled', () => {
    const { service } = commandService({});
    expect(service.archive()).toEqual({
      error: { code: 'POLICY_ACTION_NOT_ENABLED' },
      ok: false,
    });
  });
});

describe('public Catalog and search projection safety', () => {
  it('omits unavailable English instead of falling back or exposing draft content', async () => {
    const localization: CatalogLocalizationReadPort = {
      findPublicationCandidate: vi.fn(),
      findPublished: vi.fn(async (_transaction, _resource, locale) =>
        locale === 'ar'
          ? {
              humanApproved: true,
              locale: 'ar' as const,
              name: 'كرسي',
              revisionId,
              stale: false,
              state: 'PUBLISHED' as const,
            }
          : undefined,
      ),
    };
    const record = {
      categoryId: '50000000-0000-4000-8000-000000000001',
      collectionIds: [],
      colorIds: [],
      configuration: {
        collectionIds: [],
        colorIds: [],
        dependencies: [],
        dimensionRules: [],
        exclusions: [],
        materialIds: [],
        options: [],
      },
      furnitureType: 'DINING_CHAIR',
      id: productId,
      localizedResourceId,
      materialIds: [],
      startingPrice: money.value,
    };
    const query = new CatalogQueryService(
      {
        findPublicProduct: vi.fn(async () => record),
        listPublicProducts: vi.fn(async () => ({ hasMore: false, items: [record] })),
      },
      {} as CatalogPersistence,
      localization,
    );
    await expect(query.detail(manager, { locale: 'en', productId })).resolves.toEqual({
      error: { code: 'LOCALE_NOT_AVAILABLE' },
      ok: false,
    });
    await expect(query.list(manager, { limit: 12, locale: 'ar' })).resolves.toMatchObject({
      ok: true,
      value: { items: [{ locale: 'ar' as const, name: 'كرسي' }] },
    });
  });

  it('removes a stale optional English projection while retaining approved Arabic', async () => {
    const deleteProductLocaleDocument = vi.fn(async () => 1);
    const upsertDocument = vi.fn(async () => ({ changed: true }));
    const service = new CatalogSearchProjectionService(
      {
        deleteProductDocuments: vi.fn(),
        deleteProductLocaleDocument,
        findProjectionSource: vi.fn(async () => ({
          lifecycle: 'PUBLISHED' as const,
          localizedResourceId,
          recordVersion: recordVersion.value,
        })),
        search: vi.fn(),
        upsertDocument,
      },
      {
        findPublicationCandidate: vi.fn(),
        findPublished: vi.fn(async (_transaction, _resource, locale) =>
          locale === 'ar'
            ? {
                description: 'وصف',
                humanApproved: true,
                locale: 'ar' as const,
                name: 'كُرسي',
                revisionId,
                stale: false,
                state: 'PUBLISHED' as const,
              }
            : undefined,
        ),
      },
    );
    await expect(service.refreshProduct(systemJob, productId)).resolves.toEqual({
      ok: true,
      value: { documentsChanged: 2, productId, result: 'UPDATED' },
    });
    expect(deleteProductLocaleDocument).toHaveBeenCalledWith(systemJob, productId, 'en');
    expect(upsertDocument).toHaveBeenCalledWith(
      systemJob,
      expect.objectContaining({ locale: 'ar' as const, normalizedText: 'كرسي وصف' }),
    );
  });
});
