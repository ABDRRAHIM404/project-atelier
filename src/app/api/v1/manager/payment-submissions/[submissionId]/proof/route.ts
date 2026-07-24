import { getSupabaseServerClient } from '@/lib/supabase-server';
import { PaymentService } from '@/modules/payments';
import {
  requirePrivateUploadsReady,
  withWorkflowActor,
  workflowProblem,
} from '@/platform/workflow';

export const dynamic = 'force-dynamic';
const payments = new PaymentService();

type Context = Readonly<{ params: Promise<Readonly<{ submissionId: string }>> }>;

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    requirePrivateUploadsReady();
    const { submissionId } = await context.params;
    const proof = await withWorkflowActor(request, (transaction) =>
      payments.getManagerProof(transaction, submissionId),
    );
    const signed = await getSupabaseServerClient()
      .storage.from('payment-proofs')
      .createSignedUrl(proof.objectKey, 60);
    if (signed.error || !signed.data.signedUrl) throw new Error('PAYMENT_PROOF_UNAVAILABLE');
    return new Response(null, {
      headers: {
        'Cache-Control': 'private, no-store',
        Location: signed.data.signedUrl,
      },
      status: 303,
    });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
