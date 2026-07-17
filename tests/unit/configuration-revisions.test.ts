import { describe, expect, it, vi } from 'vitest';

import {
  ConfigurationService,
  parseConfigurationJsonObject,
} from '../../src/modules/business-configuration';
import type {
  ConfigurationAuditWriter,
  ConfigurationDefinition,
  ConfigurationPersistence,
  ConfigurationRevision,
  ConfigurationValueValidator,
} from '../../src/modules/business-configuration';
import type { ActorScopedTransaction } from '../../src/platform/database';
import { p1ActorContexts } from '../fixtures/p1-database';

const definition: ConfigurationDefinition = Object.freeze({
  approvalActor: 'MANAGER',
  code: 'CFG-001',
  valueSchemaVersion: 1,
});
const revision: ConfigurationRevision = Object.freeze({
  definitionCode: 'CFG-001',
  id: '50000000-0000-4000-8000-000000000001',
  lifecycle: 'DRAFT',
  revisionNumber: 1,
  value: Object.freeze({ synthetic: 'قيمة اختبار' }),
  valueSchemaVersion: 1,
});

function transaction(actorContext: ActorScopedTransaction['actorContext']): ActorScopedTransaction {
  return { actorContext } as ActorScopedTransaction;
}

function dependencies(overrides: Partial<ConfigurationPersistence> = {}) {
  const persistence: ConfigurationPersistence = {
    activateDraft: vi.fn(async () => Object.freeze({ ...revision, lifecycle: 'ACTIVE' })),
    createDraft: vi.fn(async () => revision),
    findActive: vi.fn(async () => undefined),
    findDefinition: vi.fn(async () => definition),
    findRevisionForUpdate: vi.fn(async () => revision),
    ...overrides,
  };
  const validator: ConfigurationValueValidator = { accepts: vi.fn(() => true) };
  const audit: ConfigurationAuditWriter = { configurationActivated: vi.fn(async () => undefined) };
  return {
    audit,
    persistence,
    service: new ConfigurationService(persistence, validator, audit),
    validator,
  };
}

describe('typed configuration revision rules', () => {
  it('accepts only finite, acyclic JSON objects', () => {
    expect(parseConfigurationJsonObject({ nested: ['عربي', true, 1] }).ok).toBe(true);
    expect(parseConfigurationJsonObject([])).toEqual({
      error: { code: 'CONFIGURATION_VALUE_INVALID' },
      ok: false,
    });
    expect(parseConfigurationJsonObject({ value: Number.NaN }).ok).toBe(false);
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(parseConfigurationJsonObject(cyclic).ok).toBe(false);
  });

  it('requires manager MFA before authoring and does not touch persistence on denial', async () => {
    const { persistence, service } = dependencies();
    await expect(
      service.createDraft(transaction(p1ActorContexts.managerPassword), {
        key: 'CFG-001',
        value: { synthetic: true },
      }),
    ).resolves.toEqual({ error: { code: 'CONFIGURATION_MFA_REQUIRED' }, ok: false });
    expect(persistence.createDraft).not.toHaveBeenCalled();
  });

  it('validates the registered schema before persisting a draft', async () => {
    const { persistence, service, validator } = dependencies();
    vi.mocked(validator.accepts).mockReturnValue(false);
    await expect(
      service.createDraft(transaction(p1ActorContexts.managerMfa), {
        key: 'CFG-001',
        value: { unsupported: true },
      }),
    ).resolves.toEqual({ error: { code: 'CONFIGURATION_VALUE_INVALID' }, ok: false });
    expect(persistence.createDraft).not.toHaveBeenCalled();
  });

  it('enforces the definition approval actor and audits a successful activation', async () => {
    const { audit, persistence, service } = dependencies();
    const activated = await service.activateDraft(transaction(p1ActorContexts.managerMfa), {
      correlationId: '60000000-0000-4000-8000-000000000001',
      effectiveFrom: '2026-07-16T12:00:00.000Z' as never,
      reasonCode: 'TEST_ACTIVATION',
      revisionId: revision.id,
    });
    expect(activated.ok).toBe(true);
    expect(persistence.activateDraft).toHaveBeenCalledOnce();
    expect(audit.configurationActivated).toHaveBeenCalledOnce();

    const operatorOnly = dependencies({
      findDefinition: vi.fn(async () => ({ ...definition, approvalActor: 'OPERATOR' as const })),
    });
    await expect(
      operatorOnly.service.activateDraft(transaction(p1ActorContexts.managerMfa), {
        correlationId: '60000000-0000-4000-8000-000000000001',
        effectiveFrom: '2026-07-16T12:00:00.000Z' as never,
        reasonCode: 'TEST_ACTIVATION',
        revisionId: revision.id,
      }),
    ).resolves.toEqual({
      error: { code: 'CONFIGURATION_APPROVAL_ACTOR_MISMATCH' },
      ok: false,
    });
  });
});
