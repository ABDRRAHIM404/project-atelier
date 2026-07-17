export const version1ModuleNames = [
  'access-and-identity',
  'audit-and-operations',
  'business-configuration',
  'catalog-and-search',
  'cms-and-localization',
  'customer-projects',
  'files-and-media',
  'fulfilment',
  'messaging',
  'notifications',
  'orders',
  'payments',
  'production',
  'quotations-and-acceptance',
] as const;

export type Version1ModuleName = (typeof version1ModuleNames)[number];
