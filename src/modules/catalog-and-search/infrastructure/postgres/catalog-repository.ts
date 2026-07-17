import type { QueryResultRow } from 'pg';

import type { ActorScopedTransaction } from '../../../../platform/database';
import {
  createMoney,
  parseCurrencyCode,
  parseIdentifier,
  parseRecordVersion,
  utcInstantFromDate,
  type AppLocale,
  type Identifier,
} from '../../../../shared/kernel';
import {
  buildProductConfigurationDefinition,
  type DimensionRule,
  type ProductConfigurationDefinition,
  type ProductOptionDefinition,
} from '../../domain/configuration';
import {
  parseFurnitureTypeCode,
  type CatalogManagedResourceKind,
  type CatalogProduct,
  type CatalogResourceSummary,
} from '../../domain/model';
import type {
  CatalogManagerProductView,
  CatalogPersistence,
  CatalogProductConfigurationSnapshot,
  CatalogSearchDocument,
  CatalogSearchHit,
  ManagedResourceDraftInput,
  ProductDraftInput,
  PublicCatalogProductRecord,
} from '../../ports/persistence';

type ProductRow = QueryResultRow & {
  category_id: string;
  created_at: Date;
  currency_code: string;
  furniture_type: string;
  id: string;
  lifecycle: CatalogProduct['lifecycle'];
  localized_resource_id: string;
  production_information: string | null;
  record_version: number;
  starting_amount_minor: string;
  updated_at: Date;
};

type ResourceRow = QueryResultRow & {
  id: string;
  lifecycle: CatalogResourceSummary['lifecycle'];
  localized_resource_id: string;
  record_version: number;
};

const productSelection = `
  select id, localized_resource_id, category_id, furniture_type, lifecycle,
         starting_amount_minor, currency_code, production_information,
         created_at, updated_at, record_version
  from catalog.products`;

function requireValue<Value>(value: Value | undefined, message: string): Value {
  if (value === undefined) throw new Error(message);
  return value;
}

function managerPrincipal(transaction: ActorScopedTransaction): string {
  const { actorContext } = transaction;
  if (actorContext.actor.kind !== 'manager' || actorContext.assurance !== 'manager_mfa') {
    throw new Error('Manager MFA actor context is required for catalog writes.');
  }
  return actorContext.actor.principalId;
}

function parseProduct(row: ProductRow): CatalogProduct {
  const id = parseIdentifier<'Product'>(row.id);
  const localizedResourceId = parseIdentifier<'LocalizedResource'>(row.localized_resource_id);
  const categoryId = parseIdentifier<'Category'>(row.category_id);
  const furnitureType = parseFurnitureTypeCode(row.furniture_type);
  const currency = parseCurrencyCode(row.currency_code);
  const version = parseRecordVersion(row.record_version);
  const createdAt = utcInstantFromDate(row.created_at);
  const updatedAt = utcInstantFromDate(row.updated_at);
  if (
    !id.ok ||
    !localizedResourceId.ok ||
    !categoryId.ok ||
    !furnitureType.ok ||
    !currency.ok ||
    !version.ok ||
    !createdAt.ok ||
    !updatedAt.ok
  ) {
    throw new Error('Catalog Product persistence returned invalid data.');
  }
  const price = createMoney(BigInt(row.starting_amount_minor), currency.value);
  if (!price.ok || price.value.amountMinor < 0n) {
    throw new Error('Catalog Product persistence returned an invalid price.');
  }
  return Object.freeze({
    categoryId: categoryId.value,
    createdAt: createdAt.value,
    furnitureType: furnitureType.value,
    id: id.value,
    lifecycle: row.lifecycle,
    localizedResourceId: localizedResourceId.value,
    ...(row.production_information ? { productionInformation: row.production_information } : {}),
    recordVersion: version.value,
    startingPrice: price.value,
    updatedAt: updatedAt.value,
  });
}

function resourceTable(kind: CatalogManagedResourceKind | 'PRODUCT'): string {
  switch (kind) {
    case 'CATEGORY':
      return 'catalog.categories';
    case 'COLLECTION':
      return 'catalog.collections';
    case 'MATERIAL':
      return 'catalog.materials';
    case 'COLOR':
      return 'catalog.colors';
    case 'PRODUCT_OPTION':
      return 'catalog.product_options';
    case 'PRODUCT_OPTION_VALUE':
      return 'catalog.product_option_values';
    case 'PRODUCT':
      return 'catalog.products';
  }
}

function resourceSummary(
  row: ResourceRow,
  kind: CatalogManagedResourceKind | 'PRODUCT',
): CatalogResourceSummary {
  return Object.freeze({
    id: row.id,
    kind,
    lifecycle: row.lifecycle,
    localizedResourceId: row.localized_resource_id,
    recordVersion: row.record_version,
  });
}

function toIdentifier<Entity extends string>(value: string): Identifier<Entity> {
  const parsed = parseIdentifier<Entity>(value);
  if (!parsed.ok) throw new Error('Catalog persistence received an invalid identifier.');
  return parsed.value;
}

function assertDraftConfiguration(configuration: CatalogProductConfigurationSnapshot): void {
  const optionIds = new Set<string>();
  const valueToOption = new Map<string, string>();
  for (const option of configuration.options) {
    if (optionIds.has(option.id)) throw new Error('Duplicate Product Option identifier.');
    optionIds.add(option.id);
    for (const value of option.values) {
      if (value.optionId !== option.id || valueToOption.has(value.id)) {
        throw new Error('Invalid Product Option Value ownership.');
      }
      valueToOption.set(value.id, option.id);
    }
  }
  for (const exclusion of configuration.exclusions) {
    if (
      !valueToOption.has(exclusion.leftValueId) ||
      !valueToOption.has(exclusion.rightValueId) ||
      exclusion.leftValueId === exclusion.rightValueId
    ) {
      throw new Error('Invalid Product Option exclusion.');
    }
  }
  for (const dependency of configuration.dependencies) {
    if (
      !valueToOption.has(dependency.selectedValueId) ||
      !valueToOption.has(dependency.requiredValueId) ||
      dependency.selectedValueId === dependency.requiredValueId
    ) {
      throw new Error('Invalid Product Option dependency.');
    }
  }
  if (
    new Set(configuration.dimensionRules.map((rule) => rule.dimension)).size !==
    configuration.dimensionRules.length
  ) {
    throw new Error('Duplicate Product dimension rule.');
  }
}

async function loadConfigurationSnapshot(
  transaction: ActorScopedTransaction,
  productId: string,
): Promise<CatalogProductConfigurationSnapshot> {
  const [
    collectionsResult,
    materialsResult,
    colorsResult,
    optionsResult,
    valuesResult,
    exclusionsResult,
    dependenciesResult,
    dimensionsResult,
  ] = await Promise.all([
    transaction.query<{ collection_id: string }>(
      `select collection_id from catalog.product_collections
       where product_id = $1 order by sort_order, collection_id`,
      [productId],
    ),
    transaction.query<{ material_id: string }>(
      `select material_id from catalog.product_materials
       where product_id = $1 and available order by sort_order, material_id`,
      [productId],
    ),
    transaction.query<{ color_id: string }>(
      `select color_id from catalog.product_colors
       where product_id = $1 and available order by sort_order, color_id`,
      [productId],
    ),
    transaction.query<{
      id: string;
      lifecycle: ProductOptionDefinition['lifecycle'];
      localized_resource_id: string;
      option_kind: ProductOptionDefinition['optionKind'];
      required: boolean;
      sort_order: number;
    }>(
      `select id, lifecycle, localized_resource_id, option_kind, required, sort_order
       from catalog.product_options where product_id = $1 order by sort_order, id`,
      [productId],
    ),
    transaction.query<{
      available: boolean;
      id: string;
      lifecycle: ProductOptionDefinition['values'][number]['lifecycle'];
      localized_resource_id: string;
      machine_value: string;
      option_id: string;
      sort_order: number;
    }>(
      `select v.available, v.id, v.lifecycle, v.localized_resource_id, v.machine_value,
              v.option_id, v.sort_order
       from catalog.product_option_values v join catalog.product_options o on o.id = v.option_id
       where o.product_id = $1 order by o.sort_order, v.sort_order, v.id`,
      [productId],
    ),
    transaction.query<{ left_value_id: string; right_value_id: string }>(
      `select left_value_id, right_value_id from catalog.product_option_exclusions
       where product_id = $1 order by left_value_id, right_value_id`,
      [productId],
    ),
    transaction.query<{
      dependency_kind: 'ALLOWS' | 'REQUIRES';
      required_value_id: string;
      selected_value_id: string;
    }>(
      `select dependency_kind, required_value_id, selected_value_id
       from catalog.product_option_dependencies where product_id = $1
       order by selected_value_id, required_value_id, dependency_kind`,
      [productId],
    ),
    transaction.query<{
      dimension_kind: DimensionRule['dimension'];
      fixed_value: string | null;
      maximum_value: string | null;
      minimum_value: string | null;
      rule_kind: DimensionRule['ruleKind'];
      unit: string;
    }>(
      `select dimension_kind, fixed_value::text, maximum_value::text, minimum_value::text,
              rule_kind, unit from catalog.product_dimension_rules
       where product_id = $1 order by dimension_kind`,
      [productId],
    ),
  ]);

  const valuesByOption = new Map<string, ProductOptionDefinition['values'][number][]>();
  for (const row of valuesResult.rows) {
    const values = valuesByOption.get(row.option_id) ?? [];
    values.push(
      Object.freeze({
        available: row.available,
        id: toIdentifier<'ProductOptionValue'>(row.id),
        lifecycle: row.lifecycle,
        localizedResourceId: toIdentifier<'LocalizedResource'>(row.localized_resource_id),
        machineValue: row.machine_value,
        optionId: toIdentifier<'ProductOption'>(row.option_id),
        sortOrder: row.sort_order,
      }),
    );
    valuesByOption.set(row.option_id, values);
  }

  return Object.freeze({
    colorIds: Object.freeze(colorsResult.rows.map((row) => row.color_id)),
    collectionIds: Object.freeze(collectionsResult.rows.map((row) => row.collection_id)),
    dependencies: Object.freeze(
      dependenciesResult.rows.map((row) =>
        Object.freeze({
          dependencyKind: row.dependency_kind,
          requiredValueId: toIdentifier<'ProductOptionValue'>(row.required_value_id),
          selectedValueId: toIdentifier<'ProductOptionValue'>(row.selected_value_id),
        }),
      ),
    ),
    dimensionRules: Object.freeze(
      dimensionsResult.rows.map((row) =>
        Object.freeze({
          dimension: row.dimension_kind,
          ...(row.fixed_value === null ? {} : { fixedValue: row.fixed_value }),
          ...(row.maximum_value === null ? {} : { maximumValue: row.maximum_value }),
          ...(row.minimum_value === null ? {} : { minimumValue: row.minimum_value }),
          ruleKind: row.rule_kind,
          unit: row.unit,
        }),
      ),
    ),
    exclusions: Object.freeze(
      exclusionsResult.rows.map((row) =>
        Object.freeze({
          leftValueId: toIdentifier<'ProductOptionValue'>(row.left_value_id),
          rightValueId: toIdentifier<'ProductOptionValue'>(row.right_value_id),
        }),
      ),
    ),
    materialIds: Object.freeze(materialsResult.rows.map((row) => row.material_id)),
    options: Object.freeze(
      optionsResult.rows.map((row) =>
        Object.freeze({
          id: toIdentifier<'ProductOption'>(row.id),
          lifecycle: row.lifecycle,
          localizedResourceId: toIdentifier<'LocalizedResource'>(row.localized_resource_id),
          optionKind: row.option_kind,
          required: row.required,
          sortOrder: row.sort_order,
          values: Object.freeze(valuesByOption.get(row.id) ?? []),
        }),
      ),
    ),
  });
}

export class PostgresCatalogRepository implements CatalogPersistence {
  async createManagedResourceDraft(
    transaction: ActorScopedTransaction,
    input: ManagedResourceDraftInput,
  ): Promise<CatalogResourceSummary> {
    const principalId = managerPrincipal(transaction);
    const table = resourceTable(input.kind);
    const supportsSort = input.kind === 'CATEGORY' || input.kind === 'COLLECTION';
    const result = await transaction.query<ResourceRow>(
      `insert into ${table}
         (id, localized_resource_id${supportsSort ? ', sort_order' : ''},
          created_by_principal_id, updated_by_principal_id)
       values ($1, $2${supportsSort ? ', $3' : ''}, $${supportsSort ? 4 : 3}, $${supportsSort ? 4 : 3})
       returning id, localized_resource_id, lifecycle, record_version`,
      supportsSort
        ? [input.id, input.localizedResourceId, input.sortOrder, principalId]
        : [input.id, input.localizedResourceId, principalId],
    );
    return resourceSummary(
      requireValue(result.rows[0], 'Catalog insert returned no row.'),
      input.kind,
    );
  }

  async createProductDraft(
    transaction: ActorScopedTransaction,
    input: ProductDraftInput,
  ): Promise<CatalogProduct> {
    const principalId = managerPrincipal(transaction);
    const result = await transaction.query<ProductRow>(
      `insert into catalog.products
         (id, localized_resource_id, category_id, furniture_type,
          starting_amount_minor, currency_code, production_information,
          created_by_principal_id, updated_by_principal_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       returning id, localized_resource_id, category_id, furniture_type, lifecycle,
                 starting_amount_minor, currency_code, production_information,
                 created_at, updated_at, record_version`,
      [
        input.id,
        input.localizedResourceId,
        input.categoryId,
        input.furnitureType,
        input.startingPrice.amountMinor.toString(),
        input.startingPrice.currency,
        input.productionInformation ?? null,
        principalId,
      ],
    );
    return parseProduct(requireValue(result.rows[0], 'Catalog Product insert returned no row.'));
  }

  async findResourceForUpdate(
    transaction: ActorScopedTransaction,
    resourceKind: CatalogManagedResourceKind | 'PRODUCT',
    resourceId: string,
  ): Promise<CatalogResourceSummary | undefined> {
    const result = await transaction.query<ResourceRow>(
      `select id, localized_resource_id, lifecycle, record_version
       from ${resourceTable(resourceKind)} where id = $1 for update`,
      [resourceId],
    );
    const row = result.rows[0];
    return row ? resourceSummary(row, resourceKind) : undefined;
  }

  async findProductForUpdate(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<CatalogManagerProductView | undefined> {
    const result = await transaction.query<ProductRow>(
      `${productSelection} where id = $1 for update`,
      [productId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return Object.freeze({
      configuration: await loadConfigurationSnapshot(transaction, productId),
      product: parseProduct(row),
    });
  }

  async updateProductDraft(
    transaction: ActorScopedTransaction,
    input: Parameters<CatalogPersistence['updateProductDraft']>[1],
  ): Promise<CatalogManagerProductView | undefined> {
    const principalId = managerPrincipal(transaction);
    const result = await transaction.query<ProductRow>(
      `update catalog.products set category_id = $2, furniture_type = $3,
          starting_amount_minor = $4, currency_code = $5, production_information = $6,
          updated_by_principal_id = $7, updated_at = clock_timestamp(),
          record_version = record_version + 1
       where id = $1 and lifecycle = 'DRAFT' and record_version = $8
       returning id, localized_resource_id, category_id, furniture_type, lifecycle,
                 starting_amount_minor, currency_code, production_information,
                 created_at, updated_at, record_version`,
      [
        input.productId,
        input.categoryId,
        input.furnitureType,
        input.startingPrice.amountMinor.toString(),
        input.startingPrice.currency,
        input.productionInformation ?? null,
        principalId,
        input.expectedVersion,
      ],
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          configuration: await loadConfigurationSnapshot(transaction, input.productId),
          product: parseProduct(row),
        })
      : undefined;
  }

  async replaceProductConfiguration(
    transaction: ActorScopedTransaction,
    productId: string,
    configuration: CatalogProductConfigurationSnapshot,
    expectedVersion: number,
  ): Promise<CatalogManagerProductView | undefined> {
    const principalId = managerPrincipal(transaction);
    assertDraftConfiguration(configuration);
    const locked = await transaction.query<{ id: string }>(
      `select id from catalog.products where id = $1 and lifecycle = 'DRAFT'
       and record_version = $2 for update`,
      [productId, expectedVersion],
    );
    if (!locked.rows[0]) return undefined;

    await transaction.query(
      `delete from catalog.product_option_dependencies where product_id = $1;
       delete from catalog.product_option_exclusions where product_id = $1;
       delete from catalog.product_option_values where option_id in
         (select id from catalog.product_options where product_id = $1);
       delete from catalog.product_options where product_id = $1;
       delete from catalog.product_dimension_rules where product_id = $1;
       delete from catalog.product_colors where product_id = $1;
       delete from catalog.product_materials where product_id = $1;
       delete from catalog.product_collections where product_id = $1`,
      [productId],
    );

    for (const [sortOrder, collectionId] of configuration.collectionIds.entries()) {
      await transaction.query(
        `insert into catalog.product_collections(product_id, collection_id, sort_order)
         values ($1, $2, $3)`,
        [productId, collectionId, sortOrder],
      );
    }
    for (const [sortOrder, materialId] of configuration.materialIds.entries()) {
      await transaction.query(
        `insert into catalog.product_materials(product_id, material_id, available, sort_order)
         values ($1, $2, true, $3)`,
        [productId, materialId, sortOrder],
      );
    }
    for (const [sortOrder, colorId] of configuration.colorIds.entries()) {
      await transaction.query(
        `insert into catalog.product_colors(product_id, color_id, available, sort_order)
         values ($1, $2, true, $3)`,
        [productId, colorId, sortOrder],
      );
    }
    for (const option of configuration.options) {
      await transaction.query(
        `insert into catalog.product_options
           (id, product_id, localized_resource_id, option_kind, required, lifecycle,
            sort_order, created_by_principal_id, updated_by_principal_id)
         values ($1, $2, $3, $4, $5, 'DRAFT', $6, $7, $7)`,
        [
          option.id,
          productId,
          option.localizedResourceId,
          option.optionKind,
          option.required,
          option.sortOrder,
          principalId,
        ],
      );
      for (const value of option.values) {
        await transaction.query(
          `insert into catalog.product_option_values
             (id, option_id, localized_resource_id, machine_value, available, lifecycle,
              sort_order, created_by_principal_id, updated_by_principal_id)
           values ($1, $2, $3, $4, $5, 'DRAFT', $6, $7, $7)`,
          [
            value.id,
            option.id,
            value.localizedResourceId,
            value.machineValue,
            value.available,
            value.sortOrder,
            principalId,
          ],
        );
      }
    }
    for (const exclusion of configuration.exclusions) {
      const [left, right] = [exclusion.leftValueId, exclusion.rightValueId].sort();
      await transaction.query(
        `insert into catalog.product_option_exclusions
           (product_id, left_value_id, right_value_id, created_by_principal_id)
         values ($1, $2, $3, $4)`,
        [productId, left, right, principalId],
      );
    }
    for (const dependency of configuration.dependencies) {
      await transaction.query(
        `insert into catalog.product_option_dependencies
           (product_id, selected_value_id, required_value_id, dependency_kind,
            created_by_principal_id)
         values ($1, $2, $3, $4, $5)`,
        [
          productId,
          dependency.selectedValueId,
          dependency.requiredValueId,
          dependency.dependencyKind,
          principalId,
        ],
      );
    }
    for (const rule of configuration.dimensionRules) {
      await transaction.query(
        `insert into catalog.product_dimension_rules
           (product_id, dimension_kind, rule_kind, unit, fixed_value, minimum_value,
            maximum_value, created_by_principal_id, updated_by_principal_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [
          productId,
          rule.dimension,
          rule.ruleKind,
          rule.unit,
          rule.fixedValue ?? null,
          rule.minimumValue ?? null,
          rule.maximumValue ?? null,
          principalId,
        ],
      );
    }
    const updated = await transaction.query<ProductRow>(
      `update catalog.products set updated_by_principal_id = $2,
          updated_at = clock_timestamp(), record_version = record_version + 1
       where id = $1 and lifecycle = 'DRAFT' and record_version = $3
       returning id, localized_resource_id, category_id, furniture_type, lifecycle,
                 starting_amount_minor, currency_code, production_information,
                 created_at, updated_at, record_version`,
      [productId, principalId, expectedVersion],
    );
    const row = updated.rows[0];
    return row
      ? Object.freeze({
          configuration: await loadConfigurationSnapshot(transaction, productId),
          product: parseProduct(row),
        })
      : undefined;
  }

  async publicationReadiness(
    transaction: ActorScopedTransaction,
    resource: CatalogResourceSummary,
  ): Promise<{
    categoryPublished: boolean;
    configurationValid: boolean;
    dependentLocalizedResourceIds: readonly string[];
    hasCollection: boolean;
  }> {
    if (resource.kind !== 'PRODUCT') {
      return Object.freeze({
        categoryPublished: true,
        configurationValid: true,
        dependentLocalizedResourceIds: Object.freeze([]),
        hasCollection: true,
      });
    }
    const result = await transaction.query<{
      category_published: boolean;
      configuration_valid: boolean;
      dependent_ids: string[] | null;
      has_collection: boolean;
    }>(
      `select
         c.lifecycle = 'PUBLISHED' as category_published,
         exists(select 1 from catalog.product_collections pc where pc.product_id = p.id)
           as has_collection,
         not exists (
           select 1 from catalog.product_collections pc join catalog.collections c2 on c2.id = pc.collection_id
           where pc.product_id = p.id and c2.lifecycle <> 'PUBLISHED'
           union all
           select 1 from catalog.product_materials pm join catalog.materials m on m.id = pm.material_id
           where pm.product_id = p.id and pm.available and m.lifecycle <> 'PUBLISHED'
           union all
           select 1 from catalog.product_colors pc join catalog.colors co on co.id = pc.color_id
           where pc.product_id = p.id and pc.available and co.lifecycle <> 'PUBLISHED'
           union all
           select 1 from catalog.product_options o where o.product_id = p.id
             and (o.lifecycle in ('HIDDEN','ARCHIVED') or (o.required and not exists (
               select 1 from catalog.product_option_values v where v.option_id = o.id
                 and v.available and v.lifecycle not in ('HIDDEN','ARCHIVED'))))
         ) as configuration_valid,
         array(select distinct localized_resource_id from (
           select c.localized_resource_id from catalog.categories c where c.id = p.category_id
           union all select c2.localized_resource_id from catalog.product_collections pc
             join catalog.collections c2 on c2.id = pc.collection_id where pc.product_id = p.id
           union all select m.localized_resource_id from catalog.product_materials pm
             join catalog.materials m on m.id = pm.material_id where pm.product_id = p.id and pm.available
           union all select co.localized_resource_id from catalog.product_colors pc
             join catalog.colors co on co.id = pc.color_id where pc.product_id = p.id and pc.available
           union all select o.localized_resource_id from catalog.product_options o where o.product_id = p.id
           union all select v.localized_resource_id from catalog.product_option_values v
             join catalog.product_options o on o.id = v.option_id where o.product_id = p.id and v.available
         ) dependencies) as dependent_ids
       from catalog.products p join catalog.categories c on c.id = p.category_id where p.id = $1`,
      [resource.id],
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          categoryPublished: row.category_published,
          configurationValid: row.configuration_valid,
          dependentLocalizedResourceIds: Object.freeze(row.dependent_ids ?? []),
          hasCollection: row.has_collection,
        })
      : Object.freeze({
          categoryPublished: false,
          configurationValid: false,
          dependentLocalizedResourceIds: Object.freeze([]),
          hasCollection: false,
        });
  }

  async transitionResource(
    transaction: ActorScopedTransaction,
    resource: CatalogResourceSummary,
    destination: CatalogResourceSummary['lifecycle'],
    expectedVersion: number,
  ): Promise<CatalogResourceSummary | undefined> {
    const principalId = managerPrincipal(transaction);
    if (resource.kind === 'PRODUCT' && destination === 'PUBLISHED') {
      await transaction.query(
        `update catalog.product_options set lifecycle = 'PUBLISHED',
           updated_by_principal_id = $2, updated_at = clock_timestamp(),
           record_version = record_version + 1
         where product_id = $1 and lifecycle = 'DRAFT';
         update catalog.product_option_values set lifecycle = 'PUBLISHED',
           updated_by_principal_id = $2, updated_at = clock_timestamp(),
           record_version = record_version + 1
         where option_id in (select id from catalog.product_options where product_id = $1)
           and lifecycle = 'DRAFT'`,
        [resource.id, principalId],
      );
    }
    const result = await transaction.query<ResourceRow>(
      `update ${resourceTable(resource.kind)} set lifecycle = $2,
         updated_by_principal_id = $3, updated_at = clock_timestamp(),
         record_version = record_version + 1
         ${
           resource.kind === 'PRODUCT'
             ? ", published_at = case when $2 = 'PUBLISHED' then coalesce(published_at, clock_timestamp()) else published_at end"
             : ''
         }
       where id = $1 and record_version = $4
       returning id, localized_resource_id, lifecycle, record_version`,
      [resource.id, destination, principalId, expectedVersion],
    );
    const row = result.rows[0];
    return row ? resourceSummary(row, resource.kind) : undefined;
  }

  async archiveResource(
    transaction: ActorScopedTransaction,
    resource: CatalogResourceSummary,
    expectedVersion: number,
  ): Promise<CatalogResourceSummary | undefined> {
    return this.transitionResource(transaction, resource, 'ARCHIVED', expectedVersion);
  }

  async listPublicProducts(
    transaction: ActorScopedTransaction,
    input: Parameters<CatalogPersistence['listPublicProducts']>[1],
  ): Promise<{ hasMore: boolean; items: readonly PublicCatalogProductRecord[] }> {
    const values: unknown[] = [];
    const conditions = [`p.lifecycle = 'PUBLISHED'`];
    if (input.categoryId) {
      values.push(input.categoryId);
      conditions.push(`p.category_id = $${values.length}`);
    }
    if (input.collectionId) {
      values.push(input.collectionId);
      conditions.push(
        `exists (select 1 from catalog.product_collections pc where pc.product_id = p.id and pc.collection_id = $${values.length})`,
      );
    }
    if (input.cursor) {
      values.push(input.cursor.productId);
      conditions.push(`p.id > $${values.length}`);
    }
    values.push(input.limit + 1);
    const result = await transaction.query<ProductRow>(
      `${productSelection} p where ${conditions.join(' and ')} order by p.id limit $${values.length}`,
      values,
    );
    const hasMore = result.rows.length > input.limit;
    const rows = result.rows.slice(0, input.limit);
    const items = await Promise.all(rows.map((row) => this.publicRecord(transaction, row)));
    return Object.freeze({ hasMore, items: Object.freeze(items) });
  }

  async findPublicProduct(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<PublicCatalogProductRecord | undefined> {
    const result = await transaction.query<ProductRow>(
      `${productSelection} where id = $1 and lifecycle = 'PUBLISHED'`,
      [productId],
    );
    const row = result.rows[0];
    return row ? this.publicRecord(transaction, row) : undefined;
  }

  private async publicRecord(
    transaction: ActorScopedTransaction,
    row: ProductRow,
  ): Promise<PublicCatalogProductRecord> {
    const product = parseProduct(row);
    const configuration = await loadConfigurationSnapshot(transaction, row.id);
    return Object.freeze({
      categoryId: product.categoryId,
      collectionIds: configuration.collectionIds,
      colorIds: configuration.colorIds,
      configuration,
      furnitureType: product.furnitureType,
      id: product.id,
      localizedResourceId: product.localizedResourceId,
      materialIds: configuration.materialIds,
      ...(product.productionInformation
        ? { productionInformation: product.productionInformation }
        : {}),
      startingPrice: product.startingPrice,
    });
  }

  async findProjectionSource(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<
    | {
        lifecycle: CatalogProduct['lifecycle'];
        localizedResourceId: string;
        recordVersion: CatalogProduct['recordVersion'];
      }
    | undefined
  > {
    const result = await transaction.query<{
      lifecycle: CatalogProduct['lifecycle'];
      localized_resource_id: string;
      record_version: number;
    }>(
      `select lifecycle, localized_resource_id, record_version from catalog.products where id = $1`,
      [productId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const version = parseRecordVersion(row.record_version);
    if (!version.ok) throw new Error('Invalid Product record version.');
    return Object.freeze({
      lifecycle: row.lifecycle,
      localizedResourceId: row.localized_resource_id,
      recordVersion: version.value,
    });
  }

  async upsertDocument(
    transaction: ActorScopedTransaction,
    document: CatalogSearchDocument,
  ): Promise<{ changed: boolean }> {
    const result = await transaction.query<{ product_id: string }>(
      `insert into catalog.search_documents
         (product_id, locale, source_translation_revision_id, name, description,
          normalized_text, published_at)
       select $1, $2, t.id, $4, $5, $6, t.published_at
       from cms.translation_revisions t
       where t.id = $3 and t.lifecycle = 'PUBLISHED' and not t.stale_source
       on conflict (product_id, locale) do update set
         source_translation_revision_id = excluded.source_translation_revision_id,
         name = excluded.name, description = excluded.description,
         normalized_text = excluded.normalized_text, published_at = excluded.published_at,
         refreshed_at = clock_timestamp()
       where (catalog.search_documents.source_translation_revision_id,
              catalog.search_documents.name, catalog.search_documents.description,
              catalog.search_documents.normalized_text, catalog.search_documents.published_at)
         is distinct from (excluded.source_translation_revision_id, excluded.name,
              excluded.description, excluded.normalized_text, excluded.published_at)
       returning product_id`,
      [
        document.productId,
        document.locale,
        document.sourceTranslationRevisionId,
        document.name,
        document.description ?? '',
        document.normalizedText,
      ],
    );
    return Object.freeze({ changed: Boolean(result.rows[0]) });
  }

  async deleteProductDocuments(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<number> {
    return (
      (
        await transaction.query(`delete from catalog.search_documents where product_id = $1`, [
          productId,
        ])
      ).rowCount ?? 0
    );
  }

  async deleteProductLocaleDocument(
    transaction: ActorScopedTransaction,
    productId: string,
    locale: AppLocale,
  ): Promise<number> {
    return (
      (
        await transaction.query(
          `delete from catalog.search_documents where product_id = $1 and locale = $2`,
          [productId, locale],
        )
      ).rowCount ?? 0
    );
  }

  async search(
    transaction: ActorScopedTransaction,
    input: Parameters<CatalogPersistence['search']>[1],
  ): Promise<{ hasMore: boolean; hits: readonly CatalogSearchHit[] }> {
    const result = await transaction.query<{
      description: string;
      locale: AppLocale;
      name: string;
      product_id: string;
      rank: string;
    }>(
      `with scored as (
         select d.product_id, d.locale, d.name, d.description,
           round((ts_rank_cd(d.search_vector, plainto_tsquery('simple', $2))
             + extensions.similarity(d.normalized_text, $2)
             + extensions.word_similarity($2, d.normalized_text))::numeric, 6) as rank
         from catalog.search_documents d
         join catalog.products p on p.id = d.product_id and p.lifecycle = 'PUBLISHED'
         where d.locale = $1 and (
           d.search_vector @@ plainto_tsquery('simple', $2)
           or d.normalized_text OPERATOR(extensions.%) $2
           or extensions.word_similarity($2, d.normalized_text) >= 0.3
         )
       )
       select product_id, locale, name, description, rank::text as rank
       from scored
       where ($3::numeric is null or rank < $3::numeric
         or (rank = $3::numeric and product_id > $4::uuid))
       order by rank desc, product_id asc limit $5`,
      [
        input.locale,
        input.normalizedQuery,
        input.cursor?.rank ?? null,
        input.cursor?.productId ?? null,
        input.limit + 1,
      ],
    );
    const hasMore = result.rows.length > input.limit;
    const hits = result.rows.slice(0, input.limit).map((row) =>
      Object.freeze({
        ...(row.description ? { description: row.description } : {}),
        locale: row.locale,
        name: row.name,
        productId: row.product_id,
        rank: row.rank,
      }),
    );
    return Object.freeze({ hasMore, hits: Object.freeze(hits) });
  }

  async loadConfigurationDefinition(
    transaction: ActorScopedTransaction,
    productId: string,
  ): Promise<ProductConfigurationDefinition | undefined> {
    const productResult = await transaction.query<{
      id: string;
      lifecycle: CatalogProduct['lifecycle'];
    }>(`select id, lifecycle from catalog.products where id = $1`, [productId]);
    const product = productResult.rows[0];
    if (!product) return undefined;
    const snapshot = await loadConfigurationSnapshot(transaction, productId);
    return buildProductConfigurationDefinition({
      availableColorIds: snapshot.colorIds,
      availableMaterialIds: snapshot.materialIds,
      dependencies: snapshot.dependencies,
      dimensionRules: snapshot.dimensionRules,
      exclusions: snapshot.exclusions,
      options: snapshot.options,
      productId: toIdentifier<'Product'>(product.id),
      productLifecycle: product.lifecycle,
    });
  }

  async validateConfiguration(
    transaction: ActorScopedTransaction,
    input: Parameters<CatalogPersistence['validateConfiguration']>[1],
  ): Promise<ProductConfigurationDefinition | undefined> {
    return this.loadConfigurationDefinition(transaction, input.productId);
  }
}
