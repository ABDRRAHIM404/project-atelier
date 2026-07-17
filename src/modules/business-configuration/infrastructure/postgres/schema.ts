import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const configurationSchema = pgSchema('config');

const createdAt = () => timestamp('created_at', { mode: 'date', withTimezone: true }).notNull();
const updatedAt = () => timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull();

export const businessProfile = configurationSchema.table('business_profile', {
  singletonKey: boolean('singleton_key').primaryKey(),
  legalName: text('legal_name'),
  operatingCountryCode: text('operating_country_code').notNull(),
  defaultCurrencyCode: text('default_currency_code').notNull(),
  defaultLocale: text('default_locale').notNull().$type<'ar'>(),
  timeZone: text('time_zone'),
  createdByPrincipalId: uuid('created_by_principal_id'),
  updatedByPrincipalId: uuid('updated_by_principal_id'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  recordVersion: integer('record_version').notNull(),
});

export const fulfilmentLocations = configurationSchema.table('fulfilment_locations', {
  id: uuid().defaultRandom().primaryKey(),
  locationKind: text('location_kind')
    .notNull()
    .$type<'HOME_WORKSHOP' | 'PICKUP_POINT' | 'SHOWROOM'>(),
  status: text().notNull().$type<'ACTIVE' | 'DRAFT' | 'RETIRED'>(),
  localizedNameResourceId: uuid('localized_name_resource_id'),
  addressSchemaVersion: integer('address_schema_version').notNull(),
  addressLineOne: text('address_line_one'),
  addressLineTwo: text('address_line_two'),
  locality: text(),
  region: text(),
  postalCode: text('postal_code'),
  countryCode: text('country_code').notNull(),
  publicPhone: text('public_phone'),
  publicEmail: text('public_email'),
  createdByPrincipalId: uuid('created_by_principal_id').notNull(),
  updatedByPrincipalId: uuid('updated_by_principal_id').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  recordVersion: integer('record_version').notNull(),
});

export const configurationDefinitions = configurationSchema.table('configuration_definitions', {
  code: text().primaryKey().$type<`CFG-00${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`>(),
  ownerModule: text('owner_module').notNull(),
  valueKind: text('value_kind').notNull().$type<'JSON_OBJECT'>(),
  valueSchemaVersion: integer('value_schema_version').notNull(),
  scope: text().notNull().$type<'BUSINESS_SINGLETON'>(),
  sensitivity: text().notNull().$type<'INTERNAL' | 'SECURITY_SENSITIVE'>(),
  approvalActor: text('approval_actor').notNull().$type<'MANAGER' | 'OPERATOR'>(),
  createdAt: createdAt(),
});

export const configurationRevisions = configurationSchema.table(
  'configuration_revisions',
  {
    id: uuid().defaultRandom().primaryKey(),
    definitionCode: text('definition_code')
      .notNull()
      .references(() => configurationDefinitions.code, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull(),
    valueJson: jsonb('value_json').notNull().$type<Readonly<Record<string, unknown>>>(),
    valueSchemaVersion: integer('value_schema_version').notNull(),
    lifecycle: text().notNull().$type<'ACTIVE' | 'DRAFT' | 'RETIRED'>(),
    effectiveFrom: timestamp('effective_from', { mode: 'date', withTimezone: true }),
    effectiveUntil: timestamp('effective_until', { mode: 'date', withTimezone: true }),
    authoredByActorKind: text('authored_by_actor_kind').notNull().$type<'manager' | 'operator'>(),
    authoredByPrincipalId: uuid('authored_by_principal_id'),
    approvedByActorKind: text('approved_by_actor_kind').$type<'manager' | 'operator'>(),
    approvedByPrincipalId: uuid('approved_by_principal_id'),
    activationReasonCode: text('activation_reason_code'),
    retiredAt: timestamp('retired_at', { mode: 'date', withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('configuration_revisions_sequence_unique').on(
      table.definitionCode,
      table.revisionNumber,
    ),
    uniqueIndex('configuration_revisions_one_active')
      .on(table.definitionCode)
      .where(sql`${table.lifecycle} = 'ACTIVE'`),
  ],
);

export const configurationTables = Object.freeze({
  businessProfile,
  configurationDefinitions,
  configurationRevisions,
  fulfilmentLocations,
});
