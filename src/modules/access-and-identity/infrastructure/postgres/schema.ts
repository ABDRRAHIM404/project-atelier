import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const iamSchema = pgSchema('iam');

const createdAt = () => timestamp('created_at', { mode: 'date', withTimezone: true }).notNull();
const updatedAt = () => timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull();

export const principals = iamSchema.table('principals', {
  id: uuid().defaultRandom().primaryKey(),
  actorType: text('actor_type').notNull().$type<'CUSTOMER' | 'MANAGER'>(),
  accessStatus: text('access_status').notNull().$type<'ACTIVE' | 'DISABLED'>(),
  disabledAt: timestamp('disabled_at', { mode: 'date', withTimezone: true }),
  disabledReasonCode: text('disabled_reason_code'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  recordVersion: integer('record_version').notNull(),
});

export const externalIdentities = iamSchema.table(
  'external_identities',
  {
    id: uuid().defaultRandom().primaryKey(),
    provider: text().notNull(),
    providerSubject: text('provider_subject').notNull(),
    principalId: uuid('principal_id')
      .notNull()
      .references(() => principals.id, { onDelete: 'restrict' }),
    linkStatus: text('link_status').notNull().$type<'ACTIVE' | 'UNLINKED'>(),
    isPrimary: boolean('is_primary').notNull(),
    verifiedEmailSnapshot: text('verified_email_snapshot'),
    linkedAt: timestamp('linked_at', { mode: 'date', withTimezone: true }).notNull(),
    unlinkedAt: timestamp('unlinked_at', { mode: 'date', withTimezone: true }),
    changedByPrincipalId: uuid('changed_by_principal_id').references(() => principals.id, {
      onDelete: 'restrict',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('external_identities_provider_subject_unique').on(
      table.provider,
      table.providerSubject,
    ),
    uniqueIndex('external_identities_one_active_primary_per_principal')
      .on(table.principalId)
      .where(sql`${table.linkStatus} = 'ACTIVE' and ${table.isPrimary}`),
    index('external_identities_principal_idx').on(table.principalId),
  ],
);

export const customers = iamSchema.table(
  'customers',
  {
    id: uuid().defaultRandom().primaryKey(),
    principalId: uuid('principal_id')
      .notNull()
      .references(() => principals.id, { onDelete: 'restrict' }),
    verifiedEmailSnapshot: text('verified_email_snapshot'),
    contactEmail: text('contact_email'),
    preferredLocale: text('preferred_locale').notNull().$type<'ar' | 'en'>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [uniqueIndex('customers_principal_unique').on(table.principalId)],
);

export const managers = iamSchema.table(
  'managers',
  {
    id: uuid().defaultRandom().primaryKey(),
    principalId: uuid('principal_id')
      .notNull()
      .references(() => principals.id, { onDelete: 'restrict' }),
    singletonKey: boolean('singleton_key').notNull(),
    isActive: boolean('is_active').notNull(),
    activatedAt: timestamp('activated_at', { mode: 'date', withTimezone: true }).notNull(),
    deactivatedAt: timestamp('deactivated_at', { mode: 'date', withTimezone: true }),
    bootstrapReasonCode: text('bootstrap_reason_code').notNull(),
    changedByPrincipalId: uuid('changed_by_principal_id').references(() => principals.id, {
      onDelete: 'restrict',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('managers_principal_unique').on(table.principalId),
    uniqueIndex('managers_one_active_version_one')
      .on(table.singletonKey)
      .where(sql`${table.isActive}`),
  ],
);

export const identityTables = Object.freeze({
  customers,
  externalIdentities,
  managers,
  principals,
});
