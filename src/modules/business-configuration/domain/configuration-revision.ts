import {
  err,
  ok,
  type PrincipalId,
  type ResolvedActorContext,
  type Result,
} from '../../../shared/kernel';
import type { ConfigurationKey } from './readiness';

export type JsonValue = boolean | number | string | null | JsonObject | readonly JsonValue[];
export type JsonObject = Readonly<{ [key: string]: JsonValue }>;
export type ConfigurationApprovalActor = 'MANAGER' | 'OPERATOR';

export type ConfigurationActorAttribution =
  | Readonly<{ actorKind: 'manager'; principalId: PrincipalId }>
  | Readonly<{ actorKind: 'operator' }>;

export type ConfigurationRevision = Readonly<{
  definitionCode: ConfigurationKey;
  effectiveFrom?: Date;
  id: string;
  lifecycle: 'ACTIVE' | 'DRAFT' | 'RETIRED';
  revisionNumber: number;
  value: JsonObject;
  valueSchemaVersion: number;
}>;

export type ConfigurationCommandFailure = Readonly<{
  code:
    | 'CONFIGURATION_APPROVAL_ACTOR_MISMATCH'
    | 'CONFIGURATION_MFA_REQUIRED'
    | 'CONFIGURATION_REVISION_NOT_DRAFT'
    | 'CONFIGURATION_VALUE_INVALID'
    | 'FORBIDDEN';
}>;

function isJsonValue(candidate: unknown, seen: Set<object>): candidate is JsonValue {
  if (candidate === null || typeof candidate === 'boolean' || typeof candidate === 'string') {
    return true;
  }
  if (typeof candidate === 'number') return Number.isFinite(candidate);
  if (typeof candidate !== 'object' || seen.has(candidate)) return false;
  seen.add(candidate);
  if (Array.isArray(candidate)) return candidate.every((item) => isJsonValue(item, seen));
  if (Object.getPrototypeOf(candidate) !== Object.prototype) return false;
  return Object.entries(candidate).every(
    ([key, value]) => key !== '__proto__' && key !== 'constructor' && isJsonValue(value, seen),
  );
}

export function parseConfigurationJsonObject(
  candidate: unknown,
): Result<JsonObject, ConfigurationCommandFailure> {
  return candidate !== null && !Array.isArray(candidate) && isJsonValue(candidate, new Set())
    ? ok(Object.freeze(candidate as JsonObject))
    : err({ code: 'CONFIGURATION_VALUE_INVALID' });
}

export function resolveConfigurationAttribution(
  context: ResolvedActorContext,
): Result<ConfigurationActorAttribution, ConfigurationCommandFailure> {
  if (context.actor.kind === 'operator') return ok(Object.freeze({ actorKind: 'operator' }));
  if (context.actor.kind !== 'manager') return err({ code: 'FORBIDDEN' });
  if (context.assurance !== 'manager_mfa') return err({ code: 'CONFIGURATION_MFA_REQUIRED' });
  return ok(Object.freeze({ actorKind: 'manager', principalId: context.actor.principalId }));
}

export function approvalActorMatches(
  actor: ConfigurationActorAttribution,
  required: ConfigurationApprovalActor,
): boolean {
  return (
    (actor.actorKind === 'manager' && required === 'MANAGER') ||
    (actor.actorKind === 'operator' && required === 'OPERATOR')
  );
}
