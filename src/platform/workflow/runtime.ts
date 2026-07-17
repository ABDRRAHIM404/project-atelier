import 'server-only';

import type { Pool } from 'pg';

import { CurrentIdentityResolver } from '../../modules/access-and-identity/application/resolve-current-identity';
import { createClerkAdapters } from '../../modules/access-and-identity/infrastructure/clerk/clerk-adapter';
import { PostgresIdentityRepository } from '../../modules/access-and-identity/infrastructure/postgres/identity-repository';
import { createCorrelationId } from '../observability';
import { createDatabasePool, type ActorScopedTransaction, withActorTransaction } from '../database';
import type { ResolvedActorContext } from '../../shared/kernel';
import { parseIdentifier } from '../../shared/kernel';

export type WorkflowRole = 'CUSTOMER' | 'MANAGER';

const demoIds = Object.freeze({
  customer: '71000000-0000-4000-8000-000000000001',
  customerPrincipal: '72000000-0000-4000-8000-000000000001',
  managerPrincipal: '74000000-0000-4000-8000-000000000001',
});

let workflowPool: Pool | undefined;

function demoAuthenticationEnabled(): boolean {
  const appEnvironment = process.env.APP_ENV;
  return (
    process.env.ALLOW_DEMO_AUTH === 'true' &&
    appEnvironment !== 'production' &&
    appEnvironment !== 'staging'
  );
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`WORKFLOW_CONFIGURATION_MISSING:${name}`);
  return value;
}

function pool(): Pool {
  workflowPool ??= createDatabasePool({
    applicationName: 'project-atelier-workflow',
    connectionString: requiredEnvironment('DATABASE_URL'),
    maxConnections: 10,
    statementTimeoutMilliseconds: 10_000,
  });
  return workflowPool;
}

function demoActor(request: Request): ResolvedActorContext | undefined {
  if (!demoAuthenticationEnabled()) return undefined;
  const cookie = request.headers.get('cookie') ?? '';
  const headerRole = request.headers.get('x-atelier-demo-actor');
  const cookieRole = /(?:^|;\s*)atelier_demo_actor=(customer|manager)(?:;|$)/u.exec(cookie)?.[1];
  const role = headerRole ?? cookieRole;
  if (role === 'customer') {
    const customerId = parseIdentifier<'Customer'>(demoIds.customer);
    const principalId = parseIdentifier<'Principal'>(demoIds.customerPrincipal);
    if (!customerId.ok || !principalId.ok) throw new Error('DEMO_IDENTITY_INVALID');
    return Object.freeze({
      actor: Object.freeze({ kind: 'customer', principalId: principalId.value }),
      assurance: 'customer_otp',
      customerId: customerId.value,
    });
  }
  if (role === 'manager') {
    const principalId = parseIdentifier<'Principal'>(demoIds.managerPrincipal);
    if (!principalId.ok) throw new Error('DEMO_IDENTITY_INVALID');
    return Object.freeze({
      actor: Object.freeze({ kind: 'manager', principalId: principalId.value }),
      assurance: 'manager_mfa',
    });
  }
  return undefined;
}

async function clerkActor(request: Request): Promise<ResolvedActorContext | undefined> {
  const authorizedParties = requiredEnvironment('CLERK_AUTHORIZED_PARTIES')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const clerk = createClerkAdapters({
    authorizedParties,
    publishableKey: requiredEnvironment('CLERK_PUBLISHABLE_KEY'),
    secretKey: requiredEnvironment('CLERK_SECRET_KEY'),
  });
  const session = await clerk.sessions.authenticate(request);
  if (!session.ok) return undefined;
  const resolver = new CurrentIdentityResolver(new PostgresIdentityRepository(pool()), clerk.users);
  const current = await resolver.resolve(session.value, createCorrelationId());
  return current.ok ? current.value.context : undefined;
}

export function privateUploadsReady(): boolean {
  if (demoAuthenticationEnabled()) return true;
  return process.env.PRIVATE_UPLOADS_READY === 'true';
}

export function requirePrivateUploadsReady(): void {
  if (!privateUploadsReady()) throw new Error('PRIVATE_UPLOADS_NOT_READY');
}

export async function resolveWorkflowActor(
  request: Request,
): Promise<ResolvedActorContext | undefined> {
  const actor = demoActor(request);
  if (actor || demoAuthenticationEnabled()) return actor;
  return clerkActor(request);
}

export async function withWorkflowActor<Result>(
  request: Request,
  operation: (transaction: ActorScopedTransaction) => Promise<Result>,
): Promise<Result> {
  const actor = await resolveWorkflowActor(request);
  if (!actor) throw new Error('AUTHENTICATION_REQUIRED');
  return withActorTransaction(pool(), actor, operation, { isolation: 'serializable' });
}

export function workflowRole(context: ResolvedActorContext): WorkflowRole | undefined {
  if (context.actor.kind === 'customer') return 'CUSTOMER';
  if (context.actor.kind === 'manager') return 'MANAGER';
  return undefined;
}
