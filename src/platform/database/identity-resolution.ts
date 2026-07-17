import type { Pool, QueryResult, QueryResultRow } from 'pg';

export type IdentityResolutionTransaction = Readonly<{
  query: <Row extends QueryResultRow = QueryResultRow>(
    statement: string,
    values?: readonly unknown[],
  ) => Promise<QueryResult<Row>>;
}>;

export async function withIdentityResolutionTransaction<Result>(
  pool: Pool,
  operation: (transaction: IdentityResolutionTransaction) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect();
  await client.query('begin');
  try {
    await client.query('set local role atelier_identity_resolver');
    const transaction = Object.freeze({
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
