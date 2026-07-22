import { CustomerProjectService } from '@/modules/customer-projects';
import { customDesignStoragePath, getSupabaseServerClient } from '@/lib/supabase-server';
import { requirePrivateUploadsReady, withWorkflowActor, workflowProblem } from '../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const service = new CustomerProjectService();
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

export async function POST(request: Request): Promise<Response> {
  try {
    requirePrivateUploadsReady();
    const form = await request.formData();
    const files = form.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
    if (files.length < 1 || files.length > 8) throw new Error('CUSTOM_DESIGN_FILES_REQUIRED');
    if (files.some((file) => !allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024)) {
      throw new Error('CUSTOM_DESIGN_FILE_INVALID');
    }
    const result = await withWorkflowActor(request, async (transaction) => {
      const actor = transaction.actorContext.actor;
      if (actor.kind !== 'customer') throw new Error('CUSTOMER_ROLE_REQUIRED');
      const supabase = getSupabaseServerClient();
      const uploaded: Record<string, unknown>[] = [];
      const paths: string[] = [];
      try {
        for (const file of files) {
          const path = customDesignStoragePath(actor.principalId, file);
          const upload = await supabase.storage.from('custom-designs').upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
          if (upload.error) throw new Error(upload.error.message);
          paths.push(path);
          uploaded.push({ displayName: file.name, mediaType: file.type, objectKey: path, size: file.size });
        }
        return await service.createCustomDesignRequest(transaction, {
          customerNotes: String(form.get('notes') ?? '').trim(),
          details: {
            budget: String(form.get('budget') ?? '').trim(),
            color: String(form.get('color') ?? '').trim(),
            depth: String(form.get('depth') ?? '').trim(),
            desiredDate: String(form.get('desiredDate') ?? '').trim(),
            furnitureType: String(form.get('furnitureType') ?? '').trim(),
            height: String(form.get('height') ?? '').trim(),
            material: String(form.get('material') ?? '').trim(),
            quantity: String(form.get('quantity') ?? '1').trim(),
            width: String(form.get('width') ?? '').trim(),
          },
          files: uploaded,
          title: String(form.get('title') ?? '').trim(),
        });
      } catch (error) {
        if (paths.length > 0) await supabase.storage.from('custom-designs').remove(paths);
        throw error;
      }
    });
    return Response.json(result, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
