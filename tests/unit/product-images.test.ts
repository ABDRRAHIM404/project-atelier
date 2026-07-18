import { describe, expect, it } from 'vitest';

import {
  authorizeProductImageMutation,
  determinePrimaryImageFlag,
  getNextPrimaryImageId,
  mapStorefrontProductRow,
  validateProductImageUpload,
} from '../../src/platform/workflow/product-images';

describe('product image helpers', () => {
  it('rejects unsupported image types', () => {
    const file = new File(['test'], 'note.txt', { type: 'text/plain' });

    expect(validateProductImageUpload({ existingCount: 0, file, index: 0 })).toMatchObject({
      ok: false,
      error: 'UNSUPPORTED_MEDIA_TYPE',
    });
  });

  it('rejects images larger than 5 MB', () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    });

    expect(validateProductImageUpload({ existingCount: 0, file, index: 0 })).toMatchObject({
      ok: false,
      error: 'FILE_TOO_LARGE',
    });
  });

  it('rejects a sixth image', () => {
    const file = new File(['ok'], 'image.png', { type: 'image/png' });

    expect(validateProductImageUpload({ existingCount: 5, file, index: 0 })).toMatchObject({
      ok: false,
      error: 'IMAGE_LIMIT_REACHED',
    });
  });

  it('authorizes managers and rejects customers', () => {
    expect(
      authorizeProductImageMutation({
        actor: { kind: 'manager', principalId: '11111111-1111-4111-8111-111111111111' },
        assurance: 'manager_mfa',
      } as never),
    ).toMatchObject({ ok: true });

    expect(
      authorizeProductImageMutation({
        actor: { kind: 'customer', principalId: '22222222-2222-4222-8222-222222222222' },
        assurance: 'customer_otp',
      } as never),
    ).toMatchObject({ ok: false, error: 'FORBIDDEN' });
  });

  it('marks the first uploaded image as primary', () => {
    expect(determinePrimaryImageFlag({ existingCount: 0, isFirstUpload: true })).toBe(true);
    expect(determinePrimaryImageFlag({ existingCount: 3, isFirstUpload: true })).toBe(false);
  });

  it('switches primary to another image after deleting the current primary', () => {
    expect(
      getNextPrimaryImageId(
        [
          { id: 'a', isPrimary: true },
          { id: 'b', isPrimary: false },
          { id: 'c', isPrimary: false },
        ] as never,
        'a',
      ),
    ).toBe('b');

    expect(
      getNextPrimaryImageId(
        [{ id: 'a', isPrimary: true }] as never,
        'a',
      ),
    ).toBeUndefined();
  });

  it('maps storefront images when a primary image exists', () => {
    const product = mapStorefrontProductRow({
      description: 'تصميم',
      furniture_type: 'SOFA',
      id: '33333333-3333-4333-8333-333333333333',
      image_alt: 'كنبة مميزة',
      image_url: 'https://example.com/primary.jpg',
      name: 'كنبة',
      production_information: null,
    });

    expect(product.imageAlt).toBe('كنبة مميزة');
    expect(product.imageUrl).toBe('https://example.com/primary.jpg');
  });

  it('keeps storefront fallback when no image exists', () => {
    const product = mapStorefrontProductRow({
      description: 'تصميم',
      furniture_type: 'SOFA',
      id: '33333333-3333-4333-8333-333333333333',
      name: 'كنبة',
      production_information: null,
    });

    expect(product.imageAlt).toBeUndefined();
    expect(product.imageUrl).toBeUndefined();
  });
});
