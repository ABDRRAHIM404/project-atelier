export {
  customers,
  externalIdentities,
  identityTables,
  iamSchema,
  managers,
  principals,
} from '../../modules/access-and-identity/infrastructure/postgres/schema';
export {
  auditAndOperationsTables,
  auditEvents,
  auditSchema,
  idempotencyRecords,
  inboundProviderEvents,
  jobAttempts,
  jobs,
  operationsSchema,
  outboxEvents,
} from '../../modules/audit-and-operations/infrastructure/postgres/schema';
export {
  businessProfile,
  configurationDefinitions,
  configurationRevisions,
  configurationSchema,
  configurationTables,
  fulfilmentLocations,
} from '../../modules/business-configuration/infrastructure/postgres/schema';
export {
  cmsSchema,
  cmsTables,
  contentVersions,
  contents,
  localizedResources,
  translationRevisions,
} from '../../modules/cms-and-localization/infrastructure/postgres/schema';
