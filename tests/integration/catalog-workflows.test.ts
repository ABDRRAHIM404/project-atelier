import { describe, expect, it, vi } from 'vitest';

import type { ActorScopedTransaction } from '../../src/platform/database';
import {
  CatalogCommandService,
  CatalogSearchProjectionService,
  type CatalogAuditPort,
  type CatalogInvalidationPort,
  type CatalogLocalizationReadPort,
  type CatalogPublicMediaReadPort,
  type CatalogWritePersistence,
} from '../../src/modules/catalog-and-search';
import { PostgresCatalogRepository } from '../../src/modules/catalog-and-search/infrastructure/postgres/catalog-repository';
import { parseIdentifier, parseUtcInstant } from '../../src/shared/kernel';

const principal = parseIdentifier<'Principal'>('10000000-0000-4000-8000-000000000001');
const occurredAt = parseUtcInstant('2026-07-16T12:00:00.000Z');
if (!principal.ok || !occurredAt.ok) throw new Error('Invalid Catalog integration fixtures.');

const manager = {
  actorContext: {
    actor: { kind: 'manager', principalId: principal.value },
    assurance: 'manager_mfa',
  },
} as ActorScopedTransaction;
const visitor = {
  actorContext: { actor: { kind: 'visitor' }, assurance: 'anonymous' },
} as ActorScopedTransaction;

describe('Catalog integration boundaries', () => {
  it('keeps filters and hostile search input in PostgreSQL parameters', async () => {
    const calls: { statement: string; values: readonly unknown[] }[] = [];
    const transaction = {
      ...visitor,
      query: vi.fn(async (statement: string, values: readonly unknown[] = []) => {
        calls.push({ statement, values });
        return { command: 'SELECT', fields: [], oid: 0, rowCount: 0, rows: [] };
      }),
    } as unknown as ActorScopedTransaction;
    const repository = new PostgresCatalogRepository();
    const hostile = `x' OR true; --`;
    await repository.listPublicProducts(transaction, {
      categoryId: hostile,
      collectionId: hostile,
      limit: 12,
    });
    await repository.search(transaction, {
      limit: 12,
      locale: 'ar',
      normalizedQuery: hostile,
    });
    expect(calls[0]?.statement).not.toContain(hostile);
    expect(calls[0]?.values).toContain(hostile);
    expect(calls[1]?.statement).not.toContain(hostile);
    expect(calls[1]?.values).toContain(hostile);
    expect(calls[1]?.statement).toContain('plainto_tsquery');
  });

  it('returns optimistic concurrency conflicts without writing audit or invalidation', async () => {
    const resource = {
      id: '20000000-0000-4000-8000-000000000001',
      kind: 'PRODUCT' as const,
      lifecycle: 'PUBLISHED' as const,
      localizedResourceId: '30000000-0000-4000-8000-000000000001',
      recordVersion: 4,
    };
    const persistence = {
      findResourceForUpdate: vi.fn(async () => resource),
    } as unknown as CatalogWritePersistence;
    const localization = {} as CatalogLocalizationReadPort;
    const media = {} as CatalogPublicMediaReadPort;
    const audit: CatalogAuditPort = { catalogChanged: vi.fn() };
    const invalidation: CatalogInvalidationPort = { catalogChanged: vi.fn() };
    const service = new CatalogCommandService(
      persistence,
      localization,
      media,
      audit,
      invalidation,
    );
    await expect(
      service.hide(manager, {
        correlationId: '40000000-0000-4000-8000-000000000001',
        expectedVersion: 3,
        occurredAt: occurredAt.value,
        resourceId: resource.id,
        resourceKind: 'PRODUCT',
      }),
    ).resolves.toEqual({ error: { code: 'VERSION_CONFLICT' }, ok: false });
    expect(audit.catalogChanged).not.toHaveBeenCalled();
    expect(invalidation.catalogChanged).not.toHaveBeenCalled();
  });

  it('allows only a system job to maintain the published search projection', async () => {
    const persistence = {
      findProjectionSource: vi.fn(),
    };
    const service = new CatalogSearchProjectionService(
      persistence as never,
      {} as CatalogLocalizationReadPort,
    );
    await expect(
      service.refreshProduct(visitor, '20000000-0000-4000-8000-000000000001'),
    ).resolves.toEqual({ error: { code: 'FORBIDDEN' }, ok: false });
    expect(persistence.findProjectionSource).not.toHaveBeenCalled();
  });
});
