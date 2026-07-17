import { err, ok, type ResolvedActorContext, type Result } from '../../../shared/kernel';
import type { CmsFailure } from './content';

export function requireHumanManagerMfa(
  context: ResolvedActorContext,
): Result<Readonly<{ principalId: string }>, CmsFailure> {
  if (context.actor.kind !== 'manager') return err({ code: 'FORBIDDEN' });
  if (context.assurance !== 'manager_mfa') return err({ code: 'MANAGER_MFA_REQUIRED' });
  return ok(Object.freeze({ principalId: context.actor.principalId }));
}
