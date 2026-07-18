import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';

import { getSupabaseServerClient, productImageStoragePath } from '@/lib/supabase-server';
import { withWorkflowActor, workflowProblem } from '@/platform/workflow';
import {
  authorizeProductImageMutation,
  determinePrimaryImageFlag,
  validateProductImageUpload,
} from '@/platform/workflow/product-images';

export const dynamic = 'force-dynamic';

type Context = Readonly<{ params: Promise<Readonly<{ productId: string }>> }>;

function parseMultipartFormData(request: Request): Promise<FormData> {
  return request.formData();
}

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { productId } = await context.params;
    const result = await withWorkflowActor(request, async (transaction) => {
      const rows = await transaction.query<Readonly<{ alt_text: string | null; id: string; is_primary: boolean; public_url: string; sort_order: number }>>(
        `select id, alt_text, is_primary, public_url, sort_order
         from catalog.product_images
         where product_id = $1
         order by sort_order, created_at, id`,
        [productId],
      );
      return rows.rows.map((row) => ({
        altText: row.alt_text ?? undefined,
        id: row.id,
        isPrimary: row.is_primary,
        publicUrl: row.public_url,
        sortOrder: row.sort_order,
      }));
    });
    return Response.json({ images: result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { productId } = await context.params;
    const actor = await withWorkflowActor(request, async (transaction) => {
      const auth = authorizeProductImageMutation(transaction.actorContext);
      if (!auth.ok) throw new Error('FORBIDDEN');
      const existing = await transaction.query<{ id: string; is_primary: boolean }>(
        `select id, is_primary from catalog.product_images where product_id = $1 order by sort_order, created_at, id`,
        [productId],
      );
      const form = await parseMultipartFormData(request);
      const file = form.get('file');
      if (!(file instanceof File)) throw new Error('VALIDATION_FAILED');
      const validation = validateProductImageUpload({
        existingCount: existing.rows.length,
        file,
        index: existing.rows.length,
      });
      if (!validation.ok) throw new Error(validation.error);
      if (transaction.actorContext.actor.kind !== 'manager') throw new Error('FORBIDDEN');
      const storagePath = productImageStoragePath(productId, file);
      const supabase = getSupabaseServerClient();
      const uploadResult = await supabase.storage.from('product-images').upload(storagePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
      if (uploadResult.error) throw new Error(uploadResult.error.message);
      const publicUrl = supabase.storage.from('product-images').getPublicUrl(storagePath).data.publicUrl;
      const imageId = randomUUID();
      const isPrimary = determinePrimaryImageFlag({
        existingCount: existing.rows.length,
        isFirstUpload: true,
      });
      await transaction.query(
        `insert into catalog.product_images (id, product_id, storage_path, public_url, alt_text, sort_order, is_primary, created_by_principal_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [imageId, productId, storagePath, publicUrl, form.get('altText')?.toString() || null, existing.rows.length, isPrimary, transaction.actorContext.actor.principalId],
      );
      return { imageId, publicUrl };
    });
    return NextResponse.json({ imageId: actor.imageId, publicUrl: actor.publicUrl }, { status: 201 });
  } catch (error) {
    return workflowProblem(error, request);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { productId } = await context.params;
    const result = await withWorkflowActor(request, async (transaction) => {
      const auth = authorizeProductImageMutation(transaction.actorContext);
      if (!auth.ok) throw new Error('FORBIDDEN');
      const body = await request.json().catch(() => ({}));
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('VALIDATION_FAILED');
      const imageId = typeof body.imageId === 'string' ? body.imageId : '';
      const isPrimary = typeof body.isPrimary === 'boolean' ? body.isPrimary : false;
      if (!imageId) throw new Error('VALIDATION_FAILED');
      const image = await transaction.query<{ id: string }>(
  `select id
   from catalog.product_images
   where id = $1 and product_id = $2`,
  [imageId, productId],
);

if (!image.rows[0]) {
  throw new Error('RESOURCE_NOT_FOUND');
}

if (!isPrimary) {
  throw new Error('VALIDATION_FAILED');
}

await transaction.query(
  `update catalog.product_images
   set is_primary = (id = $2)
   where product_id = $1`,
  [productId, imageId],
);
      return { ok: true };
    });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  try {
    const { productId } = await context.params;
    const result = await withWorkflowActor(request, async (transaction) => {
      const auth = authorizeProductImageMutation(transaction.actorContext);
      if (!auth.ok) throw new Error('FORBIDDEN');
      const body = await request.json().catch(() => ({}));
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('VALIDATION_FAILED');
      const imageId = typeof body.imageId === 'string' ? body.imageId : '';
      if (!imageId) throw new Error('VALIDATION_FAILED');
      const image = await transaction.query<{ id: string; is_primary: boolean; storage_path: string }>(
        `select id, is_primary, storage_path from catalog.product_images where id = $1 and product_id = $2`,
        [imageId, productId],
      );
      const record = image.rows[0];
      if (!record) throw new Error('RESOURCE_NOT_FOUND');
      await transaction.query(`delete from catalog.product_images where id = $1 and product_id = $2`, [imageId, productId]);
      if (record.is_primary) {
        const replacement = await transaction.query<{ id: string }>(
          `select id from catalog.product_images where product_id = $1 order by sort_order, created_at, id limit 1`,
          [productId],
        );
        const nextPrimaryId = replacement.rows[0]?.id;
        if (nextPrimaryId) {
          await transaction.query(`update catalog.product_images set is_primary = true where id = $1`, [nextPrimaryId]);
        }
      }
      try {
        const supabase = getSupabaseServerClient();
        await supabase.storage.from('product-images').remove([record.storage_path]);
      } catch {
        // ignore storage cleanup failures for this lean path
      }
      return { ok: true };
    });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
