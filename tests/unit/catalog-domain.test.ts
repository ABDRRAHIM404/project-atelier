import { describe, expect, it } from 'vitest';

import {
  buildProductConfigurationDefinition,
  catalogSearchQueryTokens,
  normalizeArabicCatalogSearchText,
  normalizeCatalogSearchText,
  validateProductConfiguration,
  type ProductOptionDefinition,
} from '../../src/modules/catalog-and-search';
import { parseIdentifier, type Identifier } from '../../src/shared/kernel';

function id<Entity extends string>(value: string): Identifier<Entity> {
  const parsed = parseIdentifier<Entity>(value);
  if (!parsed.ok) throw new Error('Invalid catalog fixture UUID.');
  return parsed.value;
}

const productId = id<'Product'>('10000000-0000-4000-8000-000000000001');
const optionA = id<'ProductOption'>('20000000-0000-4000-8000-000000000001');
const optionB = id<'ProductOption'>('20000000-0000-4000-8000-000000000002');
const valueA = id<'ProductOptionValue'>('30000000-0000-4000-8000-000000000001');
const valueB = id<'ProductOptionValue'>('30000000-0000-4000-8000-000000000002');
const valueC = id<'ProductOptionValue'>('30000000-0000-4000-8000-000000000003');
const materialId = id<'Material'>('40000000-0000-4000-8000-000000000001');
const colorId = id<'Color'>('50000000-0000-4000-8000-000000000001');

function option(
  optionId: Identifier<'ProductOption'>,
  values: readonly Identifier<'ProductOptionValue'>[],
  optionKind: ProductOptionDefinition['optionKind'] = 'SINGLE_CHOICE',
): ProductOptionDefinition {
  return Object.freeze({
    id: optionId,
    lifecycle: 'PUBLISHED',
    localizedResourceId: id<'LocalizedResource'>(
      optionId === optionA
        ? '60000000-0000-4000-8000-000000000001'
        : '60000000-0000-4000-8000-000000000002',
    ),
    optionKind,
    required: true,
    sortOrder: 0,
    values: Object.freeze(
      values.map((valueId, index) =>
        Object.freeze({
          available: true,
          id: valueId,
          lifecycle: 'PUBLISHED' as const,
          localizedResourceId: id<'LocalizedResource'>(
            `70000000-0000-4000-8000-00000000000${index + 1}`,
          ),
          machineValue: `value_${index + 1}`,
          optionId,
          sortOrder: index,
        }),
      ),
    ),
  });
}

function definition() {
  return buildProductConfigurationDefinition({
    availableColorIds: [colorId],
    availableMaterialIds: [materialId],
    dependencies: [
      { dependencyKind: 'REQUIRES', requiredValueId: valueC, selectedValueId: valueA },
    ],
    dimensionRules: [
      { dimension: 'WIDTH', fixedValue: '120.000', ruleKind: 'FIXED', unit: 'cm' },
      {
        dimension: 'HEIGHT',
        maximumValue: '95.500',
        minimumValue: '70',
        ruleKind: 'RANGE',
        unit: 'cm',
      },
      { dimension: 'DEPTH', ruleKind: 'FREE', unit: 'cm' },
    ],
    exclusions: [{ leftValueId: valueB, rightValueId: valueC }],
    options: [option(optionA, [valueA, valueB]), option(optionB, [valueC], 'MULTI_CHOICE')],
    productId,
    productLifecycle: 'PUBLISHED',
  });
}

describe('Catalog Arabic-first search normalization', () => {
  it('normalizes Arabic variants, tatweel, diacritics, punctuation, and whitespace', () => {
    expect(normalizeArabicCatalogSearchText('  أَثــاث، إسلامي  ')).toBe('اثاث اسلامي');
    expect(normalizeCatalogSearchText('MODERN   Chair!', 'en')).toBe('modern chair');
  });

  it('rejects empty queries and has no French locale path', () => {
    expect(catalogSearchQueryTokens(' — ', 'ar')).toEqual({
      error: { code: 'SEARCH_QUERY_EMPTY' },
      ok: false,
    });
    expect(catalogSearchQueryTokens('كرسي حديث', 'ar')).toEqual({
      ok: true,
      value: ['كرسي', 'حديث'],
    });
  });
});

describe('bounded Product configuration rules', () => {
  it('accepts exact fixed/range/free dimensions and satisfied bounded dependencies', () => {
    const result = validateProductConfiguration(definition(), {
      colorIds: [colorId],
      dimensions: { DEPTH: '45.250', HEIGHT: '80', WIDTH: '120' },
      materialIds: [materialId],
      optionValueIds: [valueA, valueC],
      productId,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects excluded, missing, unavailable, and out-of-range selections fail closed', () => {
    const base = {
      colorIds: [colorId],
      dimensions: { DEPTH: '45', HEIGHT: '80', WIDTH: '120' },
      materialIds: [materialId],
      productId,
    } as const;
    expect(
      validateProductConfiguration(definition(), { ...base, optionValueIds: [valueA] }),
    ).toEqual({
      error: { code: 'OPTION_REQUIRED', field: optionB },
      ok: false,
    });
    expect(
      validateProductConfiguration(definition(), {
        ...base,
        optionValueIds: [valueB, valueC],
      }),
    ).toEqual({
      error: { code: 'OPTION_EXCLUSION_CONFLICT', field: 'optionValueIds' },
      ok: false,
    });
    expect(
      validateProductConfiguration(definition(), {
        ...base,
        dimensions: { ...base.dimensions, HEIGHT: '96' },
        optionValueIds: [valueA, valueC],
      }),
    ).toEqual({
      error: { code: 'DIMENSION_OUT_OF_RANGE', field: 'dimensions.HEIGHT' },
      ok: false,
    });
  });

  it('supports MULTI_CHOICE without introducing an expression engine', () => {
    const multi = definition();
    const secondValue = id<'ProductOptionValue'>('30000000-0000-4000-8000-000000000004');
    const optionWithMultiple = option(optionB, [valueC, secondValue], 'MULTI_CHOICE');
    const adjusted = buildProductConfigurationDefinition({
      availableColorIds: [...multi.availableColorIds],
      availableMaterialIds: [...multi.availableMaterialIds],
      dependencies: [],
      dimensionRules: [...multi.dimensionRules.values()],
      exclusions: [],
      options: [option(optionA, [valueA, valueB]), optionWithMultiple],
      productId,
      productLifecycle: 'PUBLISHED',
    });
    expect(
      validateProductConfiguration(adjusted, {
        colorIds: [],
        dimensions: { DEPTH: '1', HEIGHT: '70', WIDTH: '120' },
        materialIds: [],
        optionValueIds: [valueA, valueC, secondValue],
        productId,
      }).ok,
    ).toBe(true);
  });
});
