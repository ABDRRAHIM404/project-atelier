export type VerifiedMigration = Readonly<{
  backwardCompatibility: string;
  checksumSha256: string;
  dataEffect: string;
  dependencies: readonly string[];
  expectedLock: string;
  file: string;
  id: string;
  owners: readonly string[];
  recovery: string;
  riskClass: string;
  sql: string;
  transactionSafe: true;
  verification: string;
}>;

export type MigrationClient = Readonly<{
  query: (query: string, values?: readonly unknown[]) => Promise<unknown>;
}>;

export function readVerifiedMigrationChain(
  projectRoot?: string,
): Promise<readonly VerifiedMigration[]>;

export function applyVerifiedMigrations(
  client: MigrationClient,
  projectRoot?: string,
): Promise<readonly VerifiedMigration[]>;
