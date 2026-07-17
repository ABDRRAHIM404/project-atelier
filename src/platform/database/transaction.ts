import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

import type { ResolvedActorContext } from '../../shared/kernel';
import * as schema from './schema';

export type DatabaseIsolationLevel = 'read committed' | 'repeatable read' | 'serializable';

export type ActorScopedTransaction = Readonly<{
  actorContext: ResolvedActorContext;
  orm: NodePgDatabase<typeof schema>;
  query: <Row extends QueryResultRow = QueryResultRow>(
    statement: string,
    values?: readonly unknown[],
  ) => Promise<QueryResult<Row>>;
}>;

function databaseRole(context: ResolvedActorContext): 'atelier_job' | 'atelier_runtime' {
  return context.actor.kind === 'system_job' ? 'atelier_job' : 'atelier_runtime';
}

function principalValue(context: ResolvedActorContext): string {
  return context.actor.kind === 'customer' || context.actor.kind === 'manager'
    ? context.actor.principalId
    : '';
}

function customerValue(context: ResolvedActorContext): string {
  return 'customerId' in context ? context.customerId : '';
}

async function setTransactionContext(
  client: PoolClient,
  context: ResolvedActorContext,
  isolation: DatabaseIsolationLevel,
): Promise<void> {
  if (isolation === 'serializable')
    await client.query('set transaction isolation level serializable');
  else if (isolation === 'repeatable read')
    await client.query('set transaction isolation level repeatable read');

  await client.query(
    `select
       set_config('atelier.actor_kind', $1, true),
       set_config('atelier.principal_id', $2, true),
       set_config('atelier.customer_id', $3, true),
       set_config('atelier.auth_assurance', $4, true)`,
    [context.actor.kind, principalValue(context), customerValue(context), context.assurance],
  );
  await client.query(`set local role ${databaseRole(context)}`);
}

export async function withActorTransaction<Result>(
  pool: Pool,
  actorContext: ResolvedActorContext,
  operation: (transaction: ActorScopedTransaction) => Promise<Result>,
  options: Readonly<{ isolation?: DatabaseIsolationLevel }> = {},
): Promise<Result> {
  const client = await pool.connect();
  await client.query('begin');
  try {
    await setTransactionContext(client, actorContext, options.isolation ?? 'read committed');
    const transaction = Object.freeze({
      actorContext,
      orm: drizzle(client, { schema }),
      query: <Row extends QueryResultRow = QueryResultRow>(
        statement: string,
        values: readonly unknown[] = [],
      ) => client.query<Row>(statement, [...values]),
    });
    const result = await operation(transaction);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
