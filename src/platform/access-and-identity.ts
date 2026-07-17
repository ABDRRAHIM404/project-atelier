import 'server-only';

import { createDatabasePool } from './database';
import { createCorrelationId } from './observability';
import { CurrentIdentityResolver } from '../modules/access-and-identity/application/resolve-current-identity';
import { SynchronizeIdentity } from '../modules/access-and-identity/application/synchronize-identity';
import { createClerkAdapters } from '../modules/access-and-identity/infrastructure/clerk/clerk-adapter';
import { ClerkWebhookVerifier } from '../modules/access-and-identity/infrastructure/clerk/clerk-webhook-verifier';
import {
  PostgresIdentityRepository,
  PostgresIdentitySynchronizationRepository,
} from '../modules/access-and-identity/infrastructure/postgres/identity-repository';
import { ClerkWebhookHandler } from '../modules/access-and-identity/presentation/http/clerk-webhook-handler';
import { GetCurrentIdentityHandler } from '../modules/access-and-identity/presentation/http/get-current-identity-handler';
import { identityProblemResponse } from '../modules/access-and-identity/presentation/http/problem-response';

type IdentityHandlers = Readonly<{
  clerkWebhook: ClerkWebhookHandler;
  currentIdentity: GetCurrentIdentityHandler;
}>;

let handlers: IdentityHandlers | undefined;

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Identity adapter environment is incomplete: ${name}.`);
  return value;
}

function buildHandlers(): IdentityHandlers {
  const authorizedParties = requiredEnvironmentValue('CLERK_AUTHORIZED_PARTIES')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const clerk = createClerkAdapters({
    authorizedParties,
    publishableKey: requiredEnvironmentValue('CLERK_PUBLISHABLE_KEY'),
    secretKey: requiredEnvironmentValue('CLERK_SECRET_KEY'),
  });
  const pool = createDatabasePool({
    applicationName: 'project-atelier-web',
    connectionString: requiredEnvironmentValue('DATABASE_URL'),
  });
  const identities = new PostgresIdentityRepository(pool);
  const synchronizer = new PostgresIdentitySynchronizationRepository(pool);

  return Object.freeze({
    clerkWebhook: new ClerkWebhookHandler(
      new ClerkWebhookVerifier(requiredEnvironmentValue('CLERK_WEBHOOK_SIGNING_SECRET')),
      new SynchronizeIdentity(synchronizer),
    ),
    currentIdentity: new GetCurrentIdentityHandler(
      clerk.sessions,
      new CurrentIdentityResolver(identities, clerk.users),
    ),
  });
}

function identityHandlers(): IdentityHandlers {
  handlers ??= buildHandlers();
  return handlers;
}

export async function handleCurrentIdentityRequest(request: Request): Promise<Response> {
  try {
    return await identityHandlers().currentIdentity.handle(request);
  } catch {
    return identityProblemResponse('IDENTITY_SERVICE_UNAVAILABLE', request, createCorrelationId());
  }
}

export async function handleClerkWebhookRequest(request: Request): Promise<Response> {
  try {
    return await identityHandlers().clerkWebhook.handle(request);
  } catch {
    return identityProblemResponse('IDENTITY_SERVICE_UNAVAILABLE', request, createCorrelationId());
  }
}
