import { Pool, type PoolConfig } from 'pg';

export type DatabasePoolConfiguration = Readonly<{
  applicationName: string;
  connectionString: string;
  maxConnections?: number;
  statementTimeoutMilliseconds?: number;
}>;

export function createDatabasePool(configuration: DatabasePoolConfiguration): Pool {
  const poolConfiguration: PoolConfig = {
    application_name: configuration.applicationName,
    connectionString: configuration.connectionString,
    max: configuration.maxConnections,
    statement_timeout: configuration.statementTimeoutMilliseconds,
  };

  return new Pool(poolConfiguration);
}
