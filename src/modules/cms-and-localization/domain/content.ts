import { createHash } from 'node:crypto';

import { err, ok, type AppLocale, type Result } from '../../../shared/kernel';

export const cmsContentKinds = [
  'HOME',
  'ABOUT',
  'CONTACT',
  'FAQ',
  'PRIVACY_POLICY',
  'TERMS_AND_CONDITIONS',
  'WARRANTY_INFORMATION',
  'CUSTOM_PAGE',
] as const;

export const cmsBlockTypes = [
  'HERO',
  'RICH_TEXT',
  'BANNER',
  'FAQ_LIST',
  'FEATURED_COLLECTIONS',
  'FEATURED_PRODUCTS',
  'INSPIRATION',
  'CONTACT_DETAILS',
] as const;

export type CmsContentKind = (typeof cmsContentKinds)[number];
export type CmsBlockType = (typeof cmsBlockTypes)[number];
export type CmsContentVisibility = 'DRAFT' | 'HIDDEN' | 'PUBLISHED';
export type CmsContentVersionLifecycle = 'DRAFT' | 'PUBLISHED';
export type TranslationLifecycle = 'APPROVED' | 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED';

export type CmsBlock = Readonly<{
  blockId: string;
  enabled: boolean;
  itemIds?: readonly string[];
  referenceIds?: readonly string[];
  type: CmsBlockType;
}>;

export type TranslationDocument = Readonly<{
  entries: Readonly<Record<string, string>>;
}>;

export type CmsContent = Readonly<{
  currentPublishedVersionId?: string;
  id: string;
  kind: CmsContentKind;
  recordVersion: number;
  slug: string;
  visibility: CmsContentVisibility;
}>;

export type CmsContentVersion = Readonly<{
  blockSchemaVersion: 1;
  blocks: readonly CmsBlock[];
  contentDigest: string;
  contentId: string;
  id: string;
  lifecycle: CmsContentVersionLifecycle;
  localizedResourceId: string;
  recordVersion: number;
  revisionNumber: number;
}>;

export type TranslationRevision = Readonly<{
  approvedByPrincipalId?: string;
  content: TranslationDocument;
  contentDigest: string;
  contentSchemaVersion: 1;
  id: string;
  lifecycle: TranslationLifecycle;
  locale: AppLocale;
  priorRevisionId?: string;
  recordVersion: number;
  resourceId: string;
  revisionNumber: number;
  sourceArabicRevisionId?: string;
  staleSource: boolean;
}>;

export type CmsFailureCode =
  | 'CONTENT_NOT_APPROVED'
  | 'FORBIDDEN'
  | 'IMMUTABLE_RECORD'
  | 'INVALID_CONTENT'
  | 'INVALID_LOCALE'
  | 'INVALID_TRANSITION'
  | 'MANAGER_MFA_REQUIRED'
  | 'NOT_FOUND'
  | 'POLICY_ACTION_NOT_ENABLED'
  | 'VERSION_CONFLICT';

export type CmsFailure = Readonly<{ code: CmsFailureCode }>;

const BLOCK_ID_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/u;
const ENTRY_KEY_PATTERN = /^[a-z][a-z0-9_.-]{1,127}$/u;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_BLOCKS = 48;
const MAX_REFERENCES = 48;
const MAX_TRANSLATION_ENTRIES = 256;
const MAX_TRANSLATION_VALUE_BYTES = 20_000;

const protectedSlugs = new Set([
  'api',
  'account',
  'auth',
  'manager',
  '_next',
  'robots.txt',
  'sitemap.xml',
]);

function hasPlainShape(candidate: unknown): candidate is Record<string, unknown> {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    !Array.isArray(candidate) &&
    Object.getPrototypeOf(candidate) === Object.prototype
  );
}

function validReferenceList(candidate: unknown): candidate is readonly string[] {
  return (
    candidate === undefined ||
    (Array.isArray(candidate) &&
      candidate.length <= MAX_REFERENCES &&
      new Set(candidate).size === candidate.length &&
      candidate.every((value) => typeof value === 'string' && UUID_PATTERN.test(value)))
  );
}

function validBlock(candidate: unknown): candidate is CmsBlock {
  if (!hasPlainShape(candidate)) return false;
  const keys = Object.keys(candidate);
  if (
    keys.some((key) => !['blockId', 'enabled', 'itemIds', 'referenceIds', 'type'].includes(key))
  ) {
    return false;
  }
  return (
    typeof candidate.blockId === 'string' &&
    BLOCK_ID_PATTERN.test(candidate.blockId) &&
    typeof candidate.enabled === 'boolean' &&
    typeof candidate.type === 'string' &&
    (cmsBlockTypes as readonly string[]).includes(candidate.type) &&
    validReferenceList(candidate.itemIds) &&
    validReferenceList(candidate.referenceIds) &&
    (candidate.type === 'FAQ_LIST' || candidate.itemIds === undefined) &&
    (candidate.type === 'FEATURED_COLLECTIONS' ||
      candidate.type === 'FEATURED_PRODUCTS' ||
      candidate.referenceIds === undefined)
  );
}

export function parseCmsContentKind(candidate: string): Result<CmsContentKind, CmsFailure> {
  return (cmsContentKinds as readonly string[]).includes(candidate)
    ? ok(candidate as CmsContentKind)
    : err({ code: 'INVALID_CONTENT' });
}

export function parseCmsSlug(candidate: string): Result<string, CmsFailure> {
  return candidate.length <= 120 && SLUG_PATTERN.test(candidate) && !protectedSlugs.has(candidate)
    ? ok(candidate)
    : err({ code: 'INVALID_CONTENT' });
}

export function parseCmsBlocks(candidate: unknown): Result<readonly CmsBlock[], CmsFailure> {
  if (
    !Array.isArray(candidate) ||
    candidate.length < 1 ||
    candidate.length > MAX_BLOCKS ||
    !candidate.every(validBlock)
  ) {
    return err({ code: 'INVALID_CONTENT' });
  }
  const ids = candidate.map((block) => block.blockId);
  if (new Set(ids).size !== ids.length) return err({ code: 'INVALID_CONTENT' });
  return ok(
    Object.freeze(
      candidate.map((block) =>
        Object.freeze({
          blockId: block.blockId,
          enabled: block.enabled,
          ...(block.itemIds ? { itemIds: Object.freeze([...block.itemIds]) } : {}),
          ...(block.referenceIds ? { referenceIds: Object.freeze([...block.referenceIds]) } : {}),
          type: block.type,
        }),
      ),
    ),
  );
}

export function requiredTranslationKeys(blocks: readonly CmsBlock[]): readonly string[] {
  const keys: string[] = [];
  for (const block of blocks.filter((item) => item.enabled)) {
    switch (block.type) {
      case 'HERO':
      case 'BANNER':
      case 'INSPIRATION':
        keys.push(`${block.blockId}.heading`, `${block.blockId}.body`);
        break;
      case 'RICH_TEXT':
        keys.push(`${block.blockId}.body`);
        break;
      case 'FAQ_LIST':
        keys.push(`${block.blockId}.heading`);
        for (const itemId of block.itemIds ?? []) {
          keys.push(`${block.blockId}.${itemId}.question`, `${block.blockId}.${itemId}.answer`);
        }
        break;
      case 'FEATURED_COLLECTIONS':
      case 'FEATURED_PRODUCTS':
      case 'CONTACT_DETAILS':
        keys.push(`${block.blockId}.heading`);
        break;
    }
  }
  return Object.freeze(keys);
}

export function parseTranslationDocument(
  candidate: unknown,
  requiredKeys: readonly string[] = [],
): Result<TranslationDocument, CmsFailure> {
  if (!hasPlainShape(candidate) || !hasPlainShape(candidate.entries)) {
    return err({ code: 'INVALID_CONTENT' });
  }
  if (Object.keys(candidate).some((key) => key !== 'entries')) {
    return err({ code: 'INVALID_CONTENT' });
  }
  const documentEntries = candidate.entries;
  const entries = Object.entries(documentEntries);
  if (
    entries.length < 1 ||
    entries.length > MAX_TRANSLATION_ENTRIES ||
    entries.some(
      ([key, value]) =>
        !ENTRY_KEY_PATTERN.test(key) ||
        typeof value !== 'string' ||
        value.trim().length < 1 ||
        Buffer.byteLength(value, 'utf8') > MAX_TRANSLATION_VALUE_BYTES ||
        /<\/?[a-z][^>]*>/iu.test(value) ||
        /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value),
    ) ||
    requiredKeys.some((key) => typeof documentEntries[key] !== 'string')
  ) {
    return err({ code: 'INVALID_CONTENT' });
  }
  return ok(
    Object.freeze({
      entries: Object.freeze(Object.fromEntries(entries) as Record<string, string>),
    }),
  );
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (hasPlainShape(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function cmsContentDigest(value: unknown): string {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

export function isLegalContentKind(kind: CmsContentKind): boolean {
  return (
    kind === 'PRIVACY_POLICY' || kind === 'TERMS_AND_CONDITIONS' || kind === 'WARRANTY_INFORMATION'
  );
}
