import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const catalogSchema = pgSchema('catalog');

const createdAt = () => timestamp('created_at', { mode: 'date', withTimezone: true }).notNull();
const updatedAt = () => timestamp('updated_at', { mode: 'date', withTimezone: true }).notNull();

const managedResourceColumns = () => ({
  id: uuid().defaultRandom().primaryKey(),
  localizedResourceId: uuid('localized_resource_id').notNull(),
  lifecycle: text().notNull().$type<'ARCHIVED' | 'DRAFT' | 'HIDDEN' | 'PUBLISHED'>(),
  sortOrder: integer('sort_order').notNull(),
  createdByPrincipalId: uuid('created_by_principal_id').notNull(),
  updatedByPrincipalId: uuid('updated_by_principal_id').notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  recordVersion: integer('record_version').notNull(),
});

const unorderedManagedResourceColumns = () => {
  const columns = managedResourceColumns();
  return {
    id: columns.id,
    localizedResourceId: columns.localizedResourceId,
    lifecycle: columns.lifecycle,
    createdByPrincipalId: columns.createdByPrincipalId,
    updatedByPrincipalId: columns.updatedByPrincipalId,
    createdAt: columns.createdAt,
    updatedAt: columns.updatedAt,
    recordVersion: columns.recordVersion,
  };
};

export const categories = catalogSchema.table('categories', managedResourceColumns, (table) => [
  uniqueIndex('categories_localized_resource_unique').on(table.localizedResourceId),
]);

export const collections = catalogSchema.table('collections', managedResourceColumns, (table) => [
  uniqueIndex('collections_localized_resource_unique').on(table.localizedResourceId),
]);

export const materials = catalogSchema.table(
  'materials',
  unorderedManagedResourceColumns,
  (table) => [uniqueIndex('materials_localized_resource_unique').on(table.localizedResourceId)],
);

export const colors = catalogSchema.table(
  'colors',
  {
    ...unorderedManagedResourceColumns(),
    displayValue: text('display_value').notNull(),
  },
  (table) => [uniqueIndex('colors_localized_resource_unique').on(table.localizedResourceId)],
);

export const products = catalogSchema.table(
  'products',
  {
    id: uuid().defaultRandom().primaryKey(),
    localizedResourceId: uuid('localized_resource_id').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    furnitureType: text('furniture_type').notNull(),
    lifecycle: text()
      .notNull()
      .$type<'ARCHIVED' | 'DRAFT' | 'HIDDEN' | 'PUBLISHED' | 'TEMPORARILY_UNAVAILABLE'>(),
    startingAmountMinor: bigint('starting_amount_minor', { mode: 'bigint' }).notNull(),
    currency: text('currency_code').notNull(),
    productionInformation: text('production_information'),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    updatedByPrincipalId: uuid('updated_by_principal_id').notNull(),
    publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('products_localized_resource_unique').on(table.localizedResourceId),
    index('products_public_category_idx')
      .on(table.categoryId, table.id)
      .where(sql`${table.lifecycle} = 'PUBLISHED'`),
  ],
);

export const productCollections = catalogSchema.table(
  'product_collections',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'restrict' }),
    sortOrder: integer('sort_order').notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.productId, table.collectionId] })],
);

export const productMaterials = catalogSchema.table(
  'product_materials',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    materialId: uuid('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    available: boolean().notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.productId, table.materialId] })],
);

export const productColors = catalogSchema.table(
  'product_colors',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    colorId: uuid('color_id')
      .notNull()
      .references(() => colors.id, { onDelete: 'restrict' }),
    available: boolean().notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.productId, table.colorId] })],
);

export const productOptions = catalogSchema.table(
  'product_options',
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    localizedResourceId: uuid('localized_resource_id').notNull(),
    optionKind: text('option_kind').notNull().$type<'MULTI_CHOICE' | 'SINGLE_CHOICE'>(),
    required: boolean().notNull(),
    sortOrder: integer('sort_order').notNull(),
    lifecycle: text().notNull().$type<'ARCHIVED' | 'DRAFT' | 'HIDDEN' | 'PUBLISHED'>(),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    updatedByPrincipalId: uuid('updated_by_principal_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('product_options_localized_resource_unique').on(table.localizedResourceId),
    index('product_options_product_sort_idx').on(table.productId, table.sortOrder),
  ],
);

export const productOptionValues = catalogSchema.table(
  'product_option_values',
  {
    id: uuid().defaultRandom().primaryKey(),
    optionId: uuid('option_id')
      .notNull()
      .references(() => productOptions.id, { onDelete: 'restrict' }),
    localizedResourceId: uuid('localized_resource_id').notNull(),
    machineValue: text('machine_value').notNull(),
    available: boolean().notNull(),
    sortOrder: integer('sort_order').notNull(),
    lifecycle: text().notNull().$type<'ARCHIVED' | 'DRAFT' | 'HIDDEN' | 'PUBLISHED'>(),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    updatedByPrincipalId: uuid('updated_by_principal_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('product_option_values_machine_unique').on(table.optionId, table.machineValue),
    uniqueIndex('product_option_values_localized_resource_unique').on(table.localizedResourceId),
    index('product_option_values_option_sort_idx').on(table.optionId, table.sortOrder),
  ],
);

export const productOptionExclusions = catalogSchema.table(
  'product_option_exclusions',
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    leftValueId: uuid('left_value_id')
      .notNull()
      .references(() => productOptionValues.id, { onDelete: 'restrict' }),
    rightValueId: uuid('right_value_id')
      .notNull()
      .references(() => productOptionValues.id, { onDelete: 'restrict' }),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('product_option_exclusions_unique').on(
      table.productId,
      table.leftValueId,
      table.rightValueId,
    ),
  ],
);

export const productOptionDependencies = catalogSchema.table(
  'product_option_dependencies',
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    selectedValueId: uuid('selected_value_id')
      .notNull()
      .references(() => productOptionValues.id, { onDelete: 'restrict' }),
    requiredValueId: uuid('required_value_id')
      .notNull()
      .references(() => productOptionValues.id, { onDelete: 'restrict' }),
    dependencyKind: text('dependency_kind').notNull().$type<'ALLOWS' | 'REQUIRES'>(),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('product_option_dependencies_unique').on(
      table.productId,
      table.selectedValueId,
      table.requiredValueId,
      table.dependencyKind,
    ),
  ],
);

export const productDimensionRules = catalogSchema.table(
  'product_dimension_rules',
  {
    id: uuid().defaultRandom().primaryKey(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    dimensionKind: text('dimension_kind')
      .notNull()
      .$type<'DEPTH' | 'HEIGHT' | 'LENGTH' | 'WIDTH'>(),
    ruleKind: text('rule_kind').notNull().$type<'FIXED' | 'FREE' | 'RANGE'>(),
    unit: text().notNull(),
    fixedValue: numeric('fixed_value'),
    minimumValue: numeric('minimum_value'),
    maximumValue: numeric('maximum_value'),
    createdByPrincipalId: uuid('created_by_principal_id').notNull(),
    updatedByPrincipalId: uuid('updated_by_principal_id').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    recordVersion: integer('record_version').notNull(),
  },
  (table) => [
    uniqueIndex('product_dimension_rules_unique').on(table.productId, table.dimensionKind),
  ],
);

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const searchDocuments = catalogSchema.table(
  'search_documents',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    locale: text().notNull().$type<'ar' | 'en'>(),
    name: text().notNull(),
    description: text().notNull(),
    normalizedText: text('normalized_text').notNull(),
    searchVector: tsvector('search_vector').notNull(),
    sourceTranslationRevisionId: uuid('source_translation_revision_id').notNull(),
    publishedAt: timestamp('published_at', { mode: 'date', withTimezone: true }).notNull(),
    refreshedAt: timestamp('refreshed_at', { mode: 'date', withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.locale] }),
    index('search_documents_locale_idx').on(table.locale),
  ],
);

export const catalogTables = Object.freeze({
  categories,
  collections,
  colors,
  materials,
  productCollections,
  productColors,
  productDimensionRules,
  productMaterials,
  productOptionDependencies,
  productOptionExclusions,
  productOptionValues,
  productOptions,
  products,
  searchDocuments,
});
