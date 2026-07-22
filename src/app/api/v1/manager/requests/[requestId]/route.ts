import { CustomerProjectService } from '@/modules/customer-projects';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import { withWorkflowActor, workflowProblem } from '../../../../../../platform/workflow';

export const dynamic = 'force-dynamic';
const projects = new CustomerProjectService();

type Context = Readonly<{ params: Promise<Readonly<{ requestId: string }>> }>;

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const { requestId } = await context.params;
    const result = await withWorkflowActor(request, (transaction) =>
      projects.getManagerRequest(transaction, requestId),
    );
    if (!result) return Response.json({ code: 'RESOURCE_NOT_FOUND' }, { status: 404 });

    let customDesignFiles = result.customDesignFiles;
    if (customDesignFiles.length > 0) {
      const supabase = getSupabaseServerClient();
      customDesignFiles = Object.freeze(
        await Promise.all(
          customDesignFiles.map(async (file) => {
            const objectKey = typeof file.objectKey === 'string' ? file.objectKey : '';
            if (!objectKey) return file;
            const signed = await supabase.storage.from('custom-designs').createSignedUrl(objectKey, 900);
            return Object.freeze({ ...file, signedUrl: signed.data?.signedUrl ?? '' });
          }),
        ),
      );
    }

    return Response.json(
      { ...result, customDesignFiles },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return workflowProblem(error, request);
  }
}
