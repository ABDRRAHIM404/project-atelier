import { err, ok, type Identifier, type Result } from '../../../shared/kernel';

export const dimensionKinds = ['WIDTH', 'HEIGHT', 'LENGTH', 'DEPTH'] as const;
export type DimensionKind = (typeof dimensionKinds)[number];
export type DimensionRuleKind = 'FIXED' | 'FREE' | 'RANGE';

export type DimensionRule = Readonly<{
  dimension: DimensionKind;
  fixedValue?: string;
  maximumValue?: string;
  minimumValue?: string;
  ruleKind: DimensionRuleKind;
  unit: string;
}>;

export type ProductOptionValueDefinition = Readonly<{
  available: boolean;
  id: Identifier<'ProductOptionValue'>;
  lifecycle: 'ARCHIVED' | 'DRAFT' | 'HIDDEN' | 'PUBLISHED';
  localizedResourceId: Identifier<'LocalizedResource'>;
  machineValue: string;
  optionId: Identifier<'ProductOption'>;
  sortOrder: number;
}>;

export type ProductOptionDefinition = Readonly<{
  id: Identifier<'ProductOption'>;
  lifecycle: 'ARCHIVED' | 'DRAFT' | 'HIDDEN' | 'PUBLISHED';
  localizedResourceId: Identifier<'LocalizedResource'>;
  optionKind: 'MULTI_CHOICE' | 'SINGLE_CHOICE';
  required: boolean;
  sortOrder: number;
  values: readonly ProductOptionValueDefinition[];
}>;

export type ProductOptionExclusion = Readonly<{
  leftValueId: Identifier<'ProductOptionValue'>;
  rightValueId: Identifier<'ProductOptionValue'>;
}>;

export type ProductOptionDependency = Readonly<{
  dependencyKind: 'ALLOWS' | 'REQUIRES';
  requiredValueId: Identifier<'ProductOptionValue'>;
  selectedValueId: Identifier<'ProductOptionValue'>;
}>;

export type ProductConfigurationDefinition = Readonly<{
  availableColorIds: ReadonlySet<string>;
  availableMaterialIds: ReadonlySet<string>;
  dependencies: readonly ProductOptionDependency[];
  dimensionRules: ReadonlyMap<DimensionKind, DimensionRule>;
  exclusions: readonly ProductOptionExclusion[];
  options: readonly ProductOptionDefinition[];
  productId: Identifier<'Product'>;
  productLifecycle: 'PUBLISHED' | 'TEMPORARILY_UNAVAILABLE' | 'HIDDEN' | 'DRAFT' | 'ARCHIVED';
}>;

export type CatalogConfigurationInput = Readonly<{
  colorIds: readonly string[];
  dimensions: Readonly<Partial<Record<DimensionKind, string>>>;
  materialIds: readonly string[];
  optionValueIds: readonly string[];
  productId: string;
}>;

export type ValidatedCatalogConfiguration = CatalogConfigurationInput &
  Readonly<{ schemaVersion: 1 }>;

export type CatalogConfigurationFailure = Readonly<{
  code:
    | 'COLOR_NOT_AVAILABLE'
    | 'DIMENSION_FIXED_VALUE_REQUIRED'
    | 'DIMENSION_OUT_OF_RANGE'
    | 'DIMENSION_VALUE_INVALID'
    | 'DUPLICATE_SELECTION'
    | 'MATERIAL_NOT_AVAILABLE'
    | 'OPTION_DEPENDENCY_UNSATISFIED'
    | 'OPTION_EXCLUSION_CONFLICT'
    | 'OPTION_REQUIRED'
    | 'OPTION_VALUE_NOT_AVAILABLE'
    | 'PRODUCT_NOT_CONFIGURABLE'
    | 'PRODUCT_NOT_FOUND';
  field?: string;
}>;

const EXACT_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;

function parseExactDecimal(
  value: string,
): Readonly<{ integer: bigint; scale: number }> | undefined {
  if (!EXACT_DECIMAL_PATTERN.test(value)) return undefined;
  const [whole = '0', fractional = ''] = value.split('.');
  return Object.freeze({ integer: BigInt(`${whole}${fractional}`), scale: fractional.length });
}

function compareExactDecimal(left: string, right: string): number | undefined {
  const parsedLeft = parseExactDecimal(left);
  const parsedRight = parseExactDecimal(right);
  if (!parsedLeft || !parsedRight) return undefined;
  const scale = Math.max(parsedLeft.scale, parsedRight.scale);
  const adjustedLeft = parsedLeft.integer * 10n ** BigInt(scale - parsedLeft.scale);
  const adjustedRight = parsedRight.integer * 10n ** BigInt(scale - parsedRight.scale);
  return adjustedLeft === adjustedRight ? 0 : adjustedLeft < adjustedRight ? -1 : 1;
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function buildProductConfigurationDefinition(
  input: Omit<
    ProductConfigurationDefinition,
    'availableColorIds' | 'availableMaterialIds' | 'dimensionRules'
  > &
    Readonly<{
      availableColorIds: readonly string[];
      availableMaterialIds: readonly string[];
      dimensionRules: readonly DimensionRule[];
    }>,
): ProductConfigurationDefinition {
  return Object.freeze({
    ...input,
    availableColorIds: new Set(input.availableColorIds),
    availableMaterialIds: new Set(input.availableMaterialIds),
    dimensionRules: new Map(input.dimensionRules.map((rule) => [rule.dimension, rule])),
  });
}

export function validateProductConfiguration(
  definition: ProductConfigurationDefinition | undefined,
  input: CatalogConfigurationInput,
): Result<ValidatedCatalogConfiguration, CatalogConfigurationFailure> {
  if (!definition || definition.productId !== input.productId) {
    return err({ code: 'PRODUCT_NOT_FOUND' });
  }
  if (definition.productLifecycle !== 'PUBLISHED') {
    return err({ code: 'PRODUCT_NOT_CONFIGURABLE' });
  }
  if (
    hasDuplicates(input.colorIds) ||
    hasDuplicates(input.materialIds) ||
    hasDuplicates(input.optionValueIds)
  ) {
    return err({ code: 'DUPLICATE_SELECTION' });
  }

  for (const materialId of input.materialIds) {
    if (!definition.availableMaterialIds.has(materialId)) {
      return err({ code: 'MATERIAL_NOT_AVAILABLE', field: 'materialIds' });
    }
  }
  for (const colorId of input.colorIds) {
    if (!definition.availableColorIds.has(colorId)) {
      return err({ code: 'COLOR_NOT_AVAILABLE', field: 'colorIds' });
    }
  }

  const selectedValues = new Set(input.optionValueIds);
  for (const option of definition.options) {
    const selectedForOption = option.values.filter((value) => selectedValues.has(value.id));
    if (option.lifecycle !== 'PUBLISHED' && selectedForOption.length > 0) {
      return err({ code: 'OPTION_VALUE_NOT_AVAILABLE', field: option.id });
    }
    if (option.required && selectedForOption.length === 0) {
      return err({ code: 'OPTION_REQUIRED', field: option.id });
    }
    if (option.optionKind === 'SINGLE_CHOICE' && selectedForOption.length > 1) {
      return err({ code: 'DUPLICATE_SELECTION', field: option.id });
    }
    if (selectedForOption.some((value) => !value.available || value.lifecycle !== 'PUBLISHED')) {
      return err({ code: 'OPTION_VALUE_NOT_AVAILABLE', field: option.id });
    }
  }
  const knownValueIds = new Set<string>(
    definition.options.flatMap((option) => option.values.map((value) => value.id)),
  );
  if (input.optionValueIds.some((valueId) => !knownValueIds.has(valueId))) {
    return err({ code: 'OPTION_VALUE_NOT_AVAILABLE', field: 'optionValueIds' });
  }

  for (const exclusion of definition.exclusions) {
    if (selectedValues.has(exclusion.leftValueId) && selectedValues.has(exclusion.rightValueId)) {
      return err({ code: 'OPTION_EXCLUSION_CONFLICT', field: 'optionValueIds' });
    }
  }
  for (const dependency of definition.dependencies) {
    if (
      dependency.dependencyKind === 'REQUIRES' &&
      selectedValues.has(dependency.selectedValueId) &&
      !selectedValues.has(dependency.requiredValueId)
    ) {
      return err({ code: 'OPTION_DEPENDENCY_UNSATISFIED', field: 'optionValueIds' });
    }
    if (
      dependency.dependencyKind === 'ALLOWS' &&
      selectedValues.has(dependency.requiredValueId) &&
      !selectedValues.has(dependency.selectedValueId)
    ) {
      return err({ code: 'OPTION_DEPENDENCY_UNSATISFIED', field: 'optionValueIds' });
    }
  }

  for (const [dimension, rule] of definition.dimensionRules) {
    const value = input.dimensions[dimension];
    if (rule.ruleKind === 'FREE') {
      if (value === undefined || !parseExactDecimal(value)) {
        return err({ code: 'DIMENSION_VALUE_INVALID', field: `dimensions.${dimension}` });
      }
      continue;
    }
    if (value === undefined || !parseExactDecimal(value)) {
      return err({ code: 'DIMENSION_VALUE_INVALID', field: `dimensions.${dimension}` });
    }
    if (rule.ruleKind === 'FIXED') {
      if (!rule.fixedValue || compareExactDecimal(value, rule.fixedValue) !== 0) {
        return err({
          code: 'DIMENSION_FIXED_VALUE_REQUIRED',
          field: `dimensions.${dimension}`,
        });
      }
      continue;
    }
    if (
      !rule.minimumValue ||
      !rule.maximumValue ||
      compareExactDecimal(value, rule.minimumValue) === undefined ||
      compareExactDecimal(value, rule.maximumValue) === undefined ||
      (compareExactDecimal(value, rule.minimumValue) ?? -1) < 0 ||
      (compareExactDecimal(value, rule.maximumValue) ?? 1) > 0
    ) {
      return err({ code: 'DIMENSION_OUT_OF_RANGE', field: `dimensions.${dimension}` });
    }
  }

  for (const dimension of Object.keys(input.dimensions)) {
    if (!definition.dimensionRules.has(dimension as DimensionKind)) {
      return err({ code: 'DIMENSION_VALUE_INVALID', field: `dimensions.${dimension}` });
    }
  }

  return ok(
    Object.freeze({
      ...input,
      colorIds: Object.freeze([...input.colorIds]),
      dimensions: Object.freeze({ ...input.dimensions }),
      materialIds: Object.freeze([...input.materialIds]),
      optionValueIds: Object.freeze([...input.optionValueIds]),
      schemaVersion: 1,
    }),
  );
}
