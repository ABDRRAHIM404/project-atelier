import { getSupabaseServerClient, handoffProofStoragePath } from '@/lib/supabase-server';
import { FulfilmentService } from '@/modules/fulfilment';
import {
  requirePrivateUploadsReady,
  withWorkflowActor,
  workflowProblem,
} from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const fulfilment = new FulfilmentService();
const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);

type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    requirePrivateUploadsReady();
    const { orderId } = await context.params;
    const form = await request.formData();
    const file = form.get('proof');
    if (!(file instanceof File) || file.size === 0) throw new Error('HANDOFF_PROOF_REQUIRED');
    if (!allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error('HANDOFF_PROOF_INVALID');
    }

    const result = await withWorkflowActor(request, async (transaction) => {
      const path = handoffProofStoragePath(orderId, file);
      const supabase = getSupabaseServerClient();
      const upload = await supabase.storage.from('handoff-proofs').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upload.error) throw new Error(upload.error.message);
      try {
        return await fulfilment.complete(transaction, {
          orderId,
          proofDisplayFilename: file.name,
          proofMediaType: file.type as 'application/pdf' | 'image/jpeg' | 'image/png',
          proofObjectKey: path,
        });
      } catch (error) {
        await supabase.storage.from('handoff-proofs').remove([path]);
        throw error;
      }
    });
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
