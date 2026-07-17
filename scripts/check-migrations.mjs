import { readVerifiedMigrationChain } from './database/migration-manifest.mjs';

const migrations = await readVerifiedMigrationChain();
console.log(`Verified ${migrations.length} ordered migration(s) and immutable checksum(s).`);
