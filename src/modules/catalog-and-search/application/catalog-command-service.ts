import { err, ok, type Money, type Result, type UtcInstant } from '../../../shared/kernel';
import type { ActorScopedTransaction } from '../../../platform/database';
import { parseFurnitureTypeCode, type CatalogManagedResourceKind } from '../domain/model';
import type {
  CatalogAuditPort,
  CatalogInvalidationPort,
  CatalogLocalizationReadPort,
  CatalogPublicMediaReadPort,
} from '../ports/integration';
import type {
  CatalogManagerProductView,
  CatalogProductConfigurationSnapshot,
  CatalogWritePersistence,
  ManagedResourceDraftInput,
  ProductDraftInput,
} from '../ports/persistence';

export type CatalogCommandFailure = Readonly<{
  code:
    | 'AUTH_ASSURANCE_REQUIRED'
    | 'FORBIDDEN'
    | 'INVALID_STATE_TRANSITION'
    | 'POLICY_ACTION_NOT_ENABLED'
    | 'RESOURCE_NOT_FOUND'
    | 'VERSION_CONFLICT'
    | 'VALIDATION_FAILED';
  issues?: readonly string[];
}>;

export type CatalogCommandContext = Readonly<{
  correlationId: string;
  occurredAt: UtcInstant;
}>;

export type CreateManagedResourceDraftCommand = CatalogCommandContext &
  Readonly<{
    id: string;
    kind: Extract<CatalogManagedResourceKind, 'CATEGORY' | 'COLLECTION' | 'MATERIAL' | 'COLOR'>;
    localizedResourceId: string;
    sortOrder: number;
  }>;

export type CreateProductDraftCommand = CatalogCommandContext &
  Readonly<{
    categoryId: string;
    furnitureType: string;
    id: string;
    localizedResourceId: string;
    productionInformation?: string;
    startingPrice: Money;
  }>;

export type UpdateProductDraftCommand = CatalogCommandContext &
  Readonly<{
    categoryId: string;
    expectedVersion: number;
    furnitureType: string;
    productId: string;
    productionInformation?: string;
    startingPrice: Money;
  }>;

export type ReplaceProductConfigurationCommand = CatalogCommandContext &
  Readonly<{
    configuration: CatalogProductConfigurationSnapshot;
    expectedVersion: number;
    productId: string;
  }>;

export type PublishCatalogResourceCommand = CatalogCommandContext &
  Readonly<{
    expectedVersion: number;
    resourceId: string;
    resourceKind: CatalogManagedResourceKind | 'PRODUCT';
  }>;

export type TransitionProductCommand = CatalogCommandContext &
  Readonly<{
    expectedVersion: number;
    productId: string;
  }>;

export type CatalogCommandResult = Readonly<{
  id: string;
  lifecycle: string;
  version: number;
}>;

function authorizeManager(
  transaction: ActorScopedTransaction,
): Result<true, CatalogCommandFailure> {
  if (transaction.actorContext.actor.kind !== 'manager') {
    return err({ code: 'FORBIDDEN' });
  }
  if (transaction.actorContext.assurance !== 'manager_mfa') {
    return err({ code: 'AUTH_ASSURANCE_REQUIRED' });
  }
  return ok(true);
}

function isPublishableStart(resourceKind: CatalogManagedResourceKind | 'PRODUCT', state: string) {
  if (resourceKind === 'PRODUCT') {
    return state === 'DRAFT' || state === 'HIDDEN' || state === 'TEMPORARILY_UNAVAILABLE';
  }
  return state === 'DRAFT' || state === 'HIDDEN';
}

export class CatalogCommandService {
  constructor(
    private readonly persistence: CatalogWritePersistence,
    private readonly localization: CatalogLocalizationReadPort,
    private readonly media: CatalogPublicMediaReadPort,
    private readonly audit: CatalogAuditPort,
    private readonly invalidation: CatalogInvalidationPort,
  ) {}

  async createManagedResourceDraft(
    transaction: ActorScopedTransaction,
    command: CreateManagedResourceDraftCommand,
  ): Promise<Result<CatalogCommandResult, CatalogCommandFailure>> {
    const authorization = authorizeManager(transaction);
    if (!authorization.ok) return authorization;
    if (!Number.isSafeInteger(command.sortOrder) || command.sortOrder < 0) {
      return err({ code: 'VALIDATION_FAILED' });
    }
    const input: ManagedResourceDraftInput = {
      id: command.id,
      kind: command.kind,
      localizedResourceId: command.localizedResourceId,
      sortOrder: command.sortOrder,
    };
    const created = await this.persistence.createManagedResourceDraft(transaction, input);
    await this.recordChange(transaction, command, {
      eventType: 'CATALOG_RESOURCE_CREATED',
      operation: 'CREATE_CATALOG_RESOURCE',
      resourceId: created.id,
      resourceKind: created.kind,
      stateAfter: created.lifecycle,
      version: created.recordVersion,
    });
    return ok({ id: created.id, lifecycle: created.lifecycle, version: created.recordVersion });
  }

  async createProductDraft(
    transaction: ActorScopedTransaction,
    command: CreateProductDraftCommand,
  ): Promise<Result<CatalogCommandResult, CatalogCommandFailure>> {
    const authorization = authorizeManager(transaction);
    if (!authorization.ok) return authorization;
    const furnitureType = parseFurnitureTypeCode(command.furnitureType);
    if (!furnitureType.ok || command.startingPrice.amountMinor < 0n) {
      return err({ code: 'VALIDATION_FAILED' });
    }
    const input: ProductDraftInput = {
      categoryId: command.categoryId,
      furnitureType: furnitureType.value,
      id: command.id,
      localizedResourceId: command.localizedResourceId,
      ...(command.productionInformation
        ? { productionInformation: command.productionInformation }
        : {}),
      startingPrice: command.startingPrice,
    };
    const created = await this.persistence.createProductDraft(transaction, input);
    await this.recordChange(transaction, command, {
      eventType: 'CATALOG_PRODUCT_CREATED',
      operation: 'CREATE_CATALOG_PRODUCT',
      resourceId: created.id,
      resourceKind: 'PRODUCT',
      stateAfter: created.lifecycle,
      version: created.recordVersion,
    });
    return ok({ id: created.id, lifecycle: created.lifecycle, version: created.recordVersion });
  }

  async updateProductDraft(
    transaction: ActorScopedTransaction,
    command: UpdateProductDraftCommand,
  ): Promise<Result<CatalogCommandResult, CatalogCommandFailure>> {
    const authorization = authorizeManager(transaction);
    if (!authorization.ok) return authorization;
    const current = await this.persistence.findProductForUpdate(transaction, command.productId);
    if (!current) return err({ code: 'RESOURCE_NOT_FOUND' });
    if (current.product.lifecycle !== 'DRAFT') {
      return err({ code: 'INVALID_STATE_TRANSITION' });
    }
    if (current.product.recordVersion !== command.expectedVersion) {
      return err({ code: 'VERSION_CONFLICT' });
    }
    const furnitureType = parseFurnitureTypeCode(command.furnitureType);
    if (!furnitureType.ok || command.startingPrice.amountMinor < 0n) {
      return err({ code: 'VALIDATION_FAILED' });
    }
    const updated = await this.persistence.updateProductDraft(transaction, {
      categoryId: command.categoryId,
      expectedVersion: command.expectedVersion,
      furnitureType: furnitureType.value,
      productId: command.productId,
      ...(command.productionInformation
        ? { productionInformation: command.productionInformation }
        : {}),
      startingPrice: command.startingPrice,
    });
    if (!updated) return err({ code: 'VERSION_CONFLICT' });
    await this.recordProductUpdate(transaction, command, updated, 'CATALOG_PRODUCT_UPDATED');
    return ok({
      id: updated.product.id,
      lifecycle: updated.product.lifecycle,
      version: updated.product.recordVersion,
    });
  }

  async replaceProductConfiguration(
    transaction: ActorScopedTransaction,
    command: ReplaceProductConfigurationCommand,
  ): Promise<Result<CatalogCommandResult, CatalogCommandFailure>> {
    const authorization = authorizeManager(transaction);
    if (!authorization.ok) return authorization;
    const current = await this.persistence.findProductForUpdate(transaction, command.productId);
    if (!current) return err({ code: 'RESOURCE_NOT_FOUND' });
    if (current.product.lifecycle !== 'DRAFT') {
      return err({ code: 'INVALID_STATE_TRANSITION' });
    }
    if (current.product.recordVersion !== command.expectedVersion) {
      return err({ code: 'VERSION_CONFLICT' });
    }
    const updated = await this.persistence.replaceProductConfiguration(
      transaction,
      command.productId,
      command.configuration,
      command.expectedVersion,
    );
    if (!updated) return err({ code: 'VERSION_CONFLICT' });
    await this.recordProductUpdate(transaction, command, updated, 'CATALOG_CONFIGURATION_UPDATED');
    return ok({
      id: updated.product.id,
      lifecycle: updated.product.lifecycle,
      version: updated.product.recordVersion,
    });
  }

  async publish(
    transaction: ActorScopedTransaction,
    command: PublishCatalogResourceCommand,
  ): Promise<Result<CatalogCommandResult, CatalogCommandFailure>> {
    const authorization = authorizeManager(transaction);
    if (!authorization.ok) return authorization;
    const resource = await this.persistence.findResourceForUpdate(
      transaction,
      command.resourceKind,
      command.resourceId,
    );
    if (!resource) return err({ code: 'RESOURCE_NOT_FOUND' });
    if (resource.recordVersion !== command.expectedVersion) {
      return err({ code: 'VERSION_CONFLICT' });
    }
    if (!isPublishableStart(command.resourceKind, resource.lifecycle)) {
      return err({ code: 'INVALID_STATE_TRANSITION' });
    }

    const [translation, storedReadiness, mediaReadiness] = await Promise.all([
      this.localization.findPublicationCandidate(transaction, resource.localizedResourceId, 'ar'),
      this.persistence.publicationReadiness(transaction, resource),
      command.resourceKind === 'PRODUCT'
        ? this.media.publicationReady(transaction, resource.id)
        : Promise.resolve({ ready: true }),
    ]);
    const issues = [
      !translation?.humanApproved || translation.stale || translation.state !== 'PUBLISHED'
        ? 'ARABIC_CONTENT_NOT_PUBLISHED'
        : undefined,
      !storedReadiness.categoryPublished ? 'CATEGORY_NOT_PUBLISHED' : undefined,
      !storedReadiness.hasCollection ? 'COLLECTION_REQUIRED' : undefined,
      !storedReadiness.configurationValid ? 'CONFIGURATION_INVALID' : undefined,
      !mediaReadiness.ready ? 'PUBLIC_MEDIA_NOT_READY' : undefined,
    ].filter((issue): issue is string => Boolean(issue));
    const dependentTranslations = await Promise.all(
      storedReadiness.dependentLocalizedResourceIds.map((localizedResourceId) =>
        this.localization.findPublicationCandidate(transaction, localizedResourceId, 'ar'),
      ),
    );
    if (
      dependentTranslations.some(
        (candidate) =>
          !candidate?.humanApproved || candidate.stale || candidate.state !== 'PUBLISHED',
      )
    ) {
      issues.push('DEPENDENT_ARABIC_CONTENT_NOT_APPROVED');
    }
    if (issues.length > 0) return err({ code: 'VALIDATION_FAILED', issues });

    const published = await this.persistence.transitionResource(
      transaction,
      resource,
      'PUBLISHED',
      command.expectedVersion,
    );
    if (!published) return err({ code: 'VERSION_CONFLICT' });
    await this.recordChange(transaction, command, {
      eventType: 'CATALOG_RESOURCE_PUBLISHED',
      operation: 'PUBLISH_CATALOG_RESOURCE',
      resourceId: published.id,
      resourceKind: published.kind,
      stateAfter: published.lifecycle,
      stateBefore: resource.lifecycle,
      version: published.recordVersion,
    });
    return ok({
      id: published.id,
      lifecycle: published.lifecycle,
      version: published.recordVersion,
    });
  }

  async hide(
    transaction: ActorScopedTransaction,
    command: PublishCatalogResourceCommand,
  ): Promise<Result<CatalogCommandResult, CatalogCommandFailure>> {
    return this.transition(transaction, command, 'HIDDEN', 'CATALOG_RESOURCE_HIDDEN');
  }

  async markTemporarilyUnavailable(
    transaction: ActorScopedTransaction,
    command: TransitionProductCommand,
  ): Promise<Result<CatalogCommandResult, CatalogCommandFailure>> {
    return this.transition(
      transaction,
      { ...command, resourceId: command.productId, resourceKind: 'PRODUCT' },
      'TEMPORARILY_UNAVAILABLE',
      'CATALOG_PRODUCT_UNAVAILABLE',
    );
  }

  archive(): Result<never, CatalogCommandFailure> {
    return err({ code: 'POLICY_ACTION_NOT_ENABLED' });
  }

  private async transition(
    transaction: ActorScopedTransaction,
    command: PublishCatalogResourceCommand,
    destination: 'HIDDEN' | 'TEMPORARILY_UNAVAILABLE',
    eventType: string,
  ): Promise<Result<CatalogCommandResult, CatalogCommandFailure>> {
    const authorization = authorizeManager(transaction);
    if (!authorization.ok) return authorization;
    const resource = await this.persistence.findResourceForUpdate(
      transaction,
      command.resourceKind,
      command.resourceId,
    );
    if (!resource) return err({ code: 'RESOURCE_NOT_FOUND' });
    if (resource.recordVersion !== command.expectedVersion) {
      return err({ code: 'VERSION_CONFLICT' });
    }
    if (
      resource.lifecycle !== 'PUBLISHED' ||
      (destination === 'TEMPORARILY_UNAVAILABLE' && command.resourceKind !== 'PRODUCT')
    ) {
      return err({ code: 'INVALID_STATE_TRANSITION' });
    }
    const changed = await this.persistence.transitionResource(
      transaction,
      resource,
      destination,
      command.expectedVersion,
    );
    if (!changed) return err({ code: 'VERSION_CONFLICT' });
    await this.recordChange(transaction, command, {
      eventType,
      operation: destination === 'HIDDEN' ? 'HIDE_CATALOG_RESOURCE' : 'DISABLE_CATALOG_PRODUCT',
      resourceId: changed.id,
      resourceKind: changed.kind,
      stateAfter: changed.lifecycle,
      stateBefore: resource.lifecycle,
      version: changed.recordVersion,
    });
    return ok({ id: changed.id, lifecycle: changed.lifecycle, version: changed.recordVersion });
  }

  private async recordProductUpdate(
    transaction: ActorScopedTransaction,
    command: CatalogCommandContext,
    updated: CatalogManagerProductView,
    eventType: string,
  ): Promise<void> {
    await this.recordChange(transaction, command, {
      eventType,
      operation: 'UPDATE_CATALOG_PRODUCT',
      resourceId: updated.product.id,
      resourceKind: 'PRODUCT',
      stateAfter: updated.product.lifecycle,
      stateBefore: updated.product.lifecycle,
      version: updated.product.recordVersion,
    });
  }

  private async recordChange(
    transaction: ActorScopedTransaction,
    command: CatalogCommandContext,
    change: Readonly<{
      eventType: string;
      operation: string;
      resourceId: string;
      resourceKind: CatalogManagedResourceKind | 'PRODUCT';
      stateAfter?: string;
      stateBefore?: string;
      version: number;
    }>,
  ): Promise<void> {
    await this.audit.catalogChanged(transaction, {
      correlationId: command.correlationId,
      eventType: change.eventType,
      occurredAt: command.occurredAt,
      operation: change.operation,
      resourceId: change.resourceId,
      resourceKind: change.resourceKind,
      ...(change.stateAfter ? { stateAfter: change.stateAfter } : {}),
      ...(change.stateBefore ? { stateBefore: change.stateBefore } : {}),
    });
    await this.invalidation.catalogChanged(transaction, {
      availableAt: command.occurredAt,
      correlationId: command.correlationId,
      eventType:
        change.eventType.includes('PUBLISHED') ||
        change.eventType.includes('HIDDEN') ||
        change.eventType.includes('UNAVAILABLE')
          ? 'CATALOG_PUBLICATION_CHANGED'
          : 'CATALOG_RESOURCE_CHANGED',
      resourceId: change.resourceId,
      resourceKind: change.resourceKind,
      revision: change.version,
    });
  }
}
