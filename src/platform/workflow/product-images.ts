import type { ResolvedActorContext } from '../../shared/kernel';

export type ProductImageRecord = Readonly<{
  id: string;
  isPrimary: boolean;
}>;

export type ProductImageUploadValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ error: 'FILE_TOO_LARGE' | 'IMAGE_LIMIT_REACHED' | 'UNSUPPORTED_MEDIA_TYPE'; ok: false }>;

export type ProductImageMutationAuthorizationResult =
  | Readonly<{ ok: true }>
  | Readonly<{ error: 'FORBIDDEN'; ok: false }>;

export function validateProductImageUpload(input: Readonly<{
  existingCount: number;
  file: File;
  index: number;
}>): ProductImageUploadValidationResult {
  if (input.existingCount >= 5) return { error: 'IMAGE_LIMIT_REACHED', ok: false };
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(input.file.type)) return { error: 'UNSUPPORTED_MEDIA_TYPE', ok: false };
  if (input.file.size > 5 * 1024 * 1024) return { error: 'FILE_TOO_LARGE', ok: false };
  return { ok: true };
}

export function authorizeProductImageMutation(context: ResolvedActorContext): ProductImageMutationAuthorizationResult {
  if (context.actor.kind !== 'manager' || context.assurance !== 'manager_mfa') {
    return { error: 'FORBIDDEN', ok: false };
  }
  return { ok: true };
}

export function determinePrimaryImageFlag(input: Readonly<{ existingCount: number; isFirstUpload: boolean }>): boolean {
  return input.isFirstUpload && input.existingCount === 0;
}

export function getNextPrimaryImageId(images: readonly ProductImageRecord[], deletedId: string): string | undefined {
  const remaining = images.filter((image) => image.id !== deletedId);
  return remaining.find((image) => image.isPrimary)?.id ?? remaining[0]?.id;
}

export type StorefrontProductRow = Readonly<{
  description: string | null;
  furniture_type: string;
  id: string;
  image_alt?: string | null;
  image_url?: string | null;
  name: string | null;
  production_information: string | null;
}>;

export function mapStorefrontProductRow(row: StorefrontProductRow): {
  description: string;
  furnitureType: string;
  id: string;
  imageAlt: string | undefined;
  imageUrl: string | undefined;
  name: string;
  productionInformation: string | undefined;
  visual: 'bed' | 'cabinet' | 'chair' | 'shelf' | 'sofa' | 'table' | 'tv-unit';
} {
  const name = row.name?.trim() || 'مسودة بدون اسم';
  const visual = 'sofa' as const;
  return {
    description: row.description?.trim() || 'تصميم يُنفذ حسب متطلبات المساحة والذوق.',
    furnitureType: row.furniture_type,
    id: row.id,
    imageAlt: row.image_alt?.trim() || undefined,
    imageUrl: row.image_url?.trim() || undefined,
    name,
    productionInformation: row.production_information ?? undefined,
    visual,
  };
}
