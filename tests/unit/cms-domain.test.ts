import { describe, expect, it, vi } from 'vitest';

import type { ActorScopedTransaction } from '../../src/platform/database';
import {
  CmsEditorialService,
  TranslationEditorialService,
  cmsContentDigest,
  parseCmsBlocks,
  parseCmsContentKind,
  parseCmsSlug,
  parseTranslationDocument,
  requiredTranslationKeys,
  type CmsAuditPort,
  type CmsOutboxPort,
  type CmsPersistence,
  type CmsPublicationPolicy,
} from '../../src/modules/cms-and-localization';
import { parseIdentifier, parseUtcInstant } from '../../src/shared/kernel';

const principal = parseIdentifier<'Principal'>('10000000-0000-4000-8000-000000000001');
const occurredAt = parseUtcInstant('2026-07-16T12:00:00.000Z');
if (!principal.ok || !occurredAt.ok) throw new Error('Invalid CMS test constants.');

const managerTransaction = {
  actorContext: {
    actor: { kind: 'manager', principalId: principal.value },
    assurance: 'manager_mfa',
  },
} as ActorScopedTransaction;

const passwordOnlyTransaction = {
  actorContext: {
    actor: { kind: 'manager', principalId: principal.value },
    assurance: 'manager_password',
  },
} as ActorScopedTransaction;

const blocks = [
  { blockId: 'welcome', enabled: true, type: 'HERO' },
  {
    blockId: 'questions',
    enabled: true,
    itemIds: ['20000000-0000-4000-8000-000000000001'],
    type: 'FAQ_LIST',
  },
] as const;

const audit: CmsAuditPort = { record: vi.fn(async () => undefined) };
const cache: CmsOutboxPort = { recordCacheInvalidation: vi.fn(async () => undefined) };
const blockedPolicy: CmsPublicationPolicy = {
  canCreateEnglish: vi.fn(async () => false),
  canHideLegalContent: vi.fn(async () => false),
  canPublishEnglish: vi.fn(async () => false),
  canPublishLegalContent: vi.fn(async () => false),
  englishReadBehavior: vi.fn(async () => 'UNAVAILABLE' as const),
};

describe('CMS bounded content model', () => {
  it('accepts only the approved Version 1 kinds and code-owned block schemas', () => {
    expect(parseCmsContentKind('HOME')).toEqual({ ok: true, value: 'HOME' });
    expect(parseCmsContentKind('SCRIPT')).toEqual({
      error: { code: 'INVALID_CONTENT' },
      ok: false,
    });
    expect(parseCmsBlocks(blocks).ok).toBe(true);
    expect(
      parseCmsBlocks([{ blockId: 'unsafe', enabled: true, script: 'alert(1)', type: 'HERO' }]),
    ).toEqual({ error: { code: 'INVALID_CONTENT' }, ok: false });
    expect(
      parseCmsBlocks([{ blockId: 'unsafe', enabled: true, type: 'EXECUTABLE_FORMULA' }]),
    ).toEqual({ error: { code: 'INVALID_CONTENT' }, ok: false });
  });

  it('blocks protected routes and unsafe slugs', () => {
    expect(parseCmsSlug('about-us')).toEqual({ ok: true, value: 'about-us' });
    expect(parseCmsSlug('api').ok).toBe(false);
    expect(parseCmsSlug('../manager').ok).toBe(false);
    expect(parseCmsSlug('À-propos').ok).toBe(false);
  });

  it('derives complete Arabic source keys and rejects incomplete or active content', () => {
    const parsedBlocks = parseCmsBlocks(blocks);
    if (!parsedBlocks.ok) throw new Error('Fixture blocks must be valid.');
    const keys = requiredTranslationKeys(parsedBlocks.value);
    expect(keys).toEqual([
      'welcome.heading',
      'welcome.body',
      'questions.heading',
      'questions.20000000-0000-4000-8000-000000000001.question',
      'questions.20000000-0000-4000-8000-000000000001.answer',
    ]);
    expect(parseTranslationDocument({ entries: { 'welcome.heading': 'أهلاً' } }, keys).ok).toBe(
      false,
    );
    expect(parseTranslationDocument({ entries: { body: '<script>alert(1)</script>' } }).ok).toBe(
      false,
    );
    expect(parseTranslationDocument({ entries: { body: `unsafe\u0000control` } }).ok).toBe(false);
  });

  it('creates stable digests independent of object property ordering', () => {
    expect(cmsContentDigest({ b: 2, a: { d: 4, c: 3 } })).toBe(
      cmsContentDigest({ a: { c: 3, d: 4 }, b: 2 }),
    );
  });
});

describe('CMS fail-closed editorial rules', () => {
  it('requires Manager MFA for every editorial command', async () => {
    const service = new CmsEditorialService({} as CmsPersistence, audit, cache, blockedPolicy);
    await expect(
      service.createContent(passwordOnlyTransaction, {
        blocks,
        correlationId: '30000000-0000-4000-8000-000000000001',
        kind: 'HOME',
        occurredAt: occurredAt.value,
        slug: 'home',
      }),
    ).resolves.toEqual({ error: { code: 'MANAGER_MFA_REQUIRED' }, ok: false });
  });

  it('makes French impossible and disables English without explicit configuration', async () => {
    const service = new TranslationEditorialService(
      {
        createTranslationDraft: vi.fn(),
        findTranslation: vi.fn(async () => ({
          content: { entries: { title: 'مصدر' } },
          contentDigest: 'a'.repeat(64),
          contentSchemaVersion: 1,
          id: '50000000-0000-4000-8000-000000000001',
          lifecycle: 'APPROVED',
          locale: 'ar',
          recordVersion: 3,
          resourceId: '40000000-0000-4000-8000-000000000001',
          revisionNumber: 1,
          staleSource: false,
        })),
      } as unknown as CmsPersistence,
      audit,
      blockedPolicy,
    );
    const base = {
      content: { entries: { title: 'Texte' } },
      correlationId: '30000000-0000-4000-8000-000000000001',
      occurredAt: occurredAt.value,
      resourceId: '40000000-0000-4000-8000-000000000001',
    };
    await expect(
      service.createDraft(managerTransaction, { ...base, locale: 'fr' }),
    ).resolves.toEqual({ error: { code: 'INVALID_LOCALE' }, ok: false });
    await expect(
      service.createDraft(managerTransaction, {
        ...base,
        locale: 'en',
        sourceArabicRevisionId: '50000000-0000-4000-8000-000000000001',
      }),
    ).resolves.toEqual({ error: { code: 'POLICY_ACTION_NOT_ENABLED' }, ok: false });
  });

  it('blocks legal publication when BP-010 has no approved value', async () => {
    const content = {
      id: '60000000-0000-4000-8000-000000000001',
      kind: 'PRIVACY_POLICY' as const,
      recordVersion: 1,
      slug: 'privacy-policy',
      visibility: 'DRAFT' as const,
    };
    const version = {
      blockSchemaVersion: 1 as const,
      blocks: [{ blockId: 'policy', enabled: true, type: 'RICH_TEXT' as const }],
      contentDigest: 'a'.repeat(64),
      contentId: content.id,
      id: '70000000-0000-4000-8000-000000000001',
      lifecycle: 'DRAFT' as const,
      localizedResourceId: '80000000-0000-4000-8000-000000000001',
      recordVersion: 1,
      revisionNumber: 1,
    };
    const persistence = {
      findContent: vi.fn(async () => content),
      findContentVersion: vi.fn(async () => version),
      publishContent: vi.fn(),
    } as unknown as CmsPersistence;
    const service = new CmsEditorialService(persistence, audit, cache, blockedPolicy);
    await expect(
      service.publishContent(managerTransaction, {
        contentId: content.id,
        correlationId: '30000000-0000-4000-8000-000000000001',
        expectedContentVersion: 1,
        occurredAt: occurredAt.value,
        versionId: version.id,
      }),
    ).resolves.toEqual({ error: { code: 'POLICY_ACTION_NOT_ENABLED' }, ok: false });
    expect(persistence.publishContent).not.toHaveBeenCalled();
  });
});
