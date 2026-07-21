import { PaymentService } from '@/modules/payments';
import { getSupabaseServerClient, paymentProofStoragePath } from '@/lib/supabase-server';
import {
  requirePrivateUploadsReady,
  withWorkflowActor,
  workflowProblem,
} from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const payments = new PaymentService();
type Context = Readonly<{ params: Promise<Readonly<{ orderId: string }>> }>;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    requirePrivateUploadsReady();
    const { orderId } = await context.params;
    const form = await request.formData();
    const file = form.get('receipt');
    if (!(file instanceof File) || file.size === 0) throw new Error('PAYMENT_PROOF_REQUIRED');
    if (!allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) {
      throw new Error('PAYMENT_PROOF_INVALID');
    }

    const result = await withWorkflowActor(request, async (transaction) => {
      const path = paymentProofStoragePath(orderId, file);
      const supabase = getSupabaseServerClient();
      const upload = await supabase.storage.from('payment-proofs').upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upload.error) throw new Error(upload.error.message);
      try {
        return await payments.submitProof(transaction, {
          declaredReference: String(form.get('declaredReference') ?? '').trim() || undefined,
          orderId,
          proofDisplayFilename: file.name,
          proofMediaType: file.type as 'application/pdf' | 'image/jpeg' | 'image/png',
          proofObjectKey: path,
        });
      } catch (error) {
        await supabase.storage.from('payment-proofs').remove([path]);
        throw error;
      }
    });
    return Response.json(result, {
      status: 201,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
