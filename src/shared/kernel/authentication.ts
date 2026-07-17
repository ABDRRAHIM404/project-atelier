export const authenticationAssuranceLevels = [
  'anonymous',
  'customer_otp',
  'manager_password',
  'manager_mfa',
  'provider_signature',
  'system_job',
  'operator',
] as const;

export type AuthenticationAssurance = (typeof authenticationAssuranceLevels)[number];

export function assuranceSatisfiesManagerMfa(assurance: AuthenticationAssurance): boolean {
  return assurance === 'manager_mfa';
}
