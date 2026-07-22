import { readJsonObject, withWorkflowActor, workflowProblem } from '../../../../platform/workflow';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const profile = await withWorkflowActor(request, async (transaction) => {
      const context = transaction.actorContext;
      if (context.actor.kind !== 'customer' || !('customerId' in context)) {
        throw new Error('CUSTOMER_AUTHENTICATION_REQUIRED');
      }
      const result = await transaction.query<{
        address: string | null;
        city: string | null;
        full_name: string | null;
        phone_number: string | null;
      }>(`select full_name, phone_number, city, address from iam.customers where id = $1`, [context.customerId]);
      const row = result.rows[0];
      return {
        address: row?.address ?? '',
        city: row?.city ?? '',
        fullName: row?.full_name ?? '',
        phoneNumber: row?.phone_number ?? '',
      };
    });
    return Response.json(profile, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = await readJsonObject(request);
    const profile = await withWorkflowActor(request, async (transaction) => {
      const context = transaction.actorContext;
      if (context.actor.kind !== 'customer' || !('customerId' in context)) {
        throw new Error('CUSTOMER_AUTHENTICATION_REQUIRED');
      }
      const fullName = String(body.fullName ?? '').trim();
      const phoneNumber = String(body.phoneNumber ?? '').trim();
      const city = String(body.city ?? '').trim();
      const address = String(body.address ?? '').trim();
      if (fullName.length < 2 || phoneNumber.length < 6 || city.length < 2) throw new Error('VALIDATION_FAILED');
      await transaction.query(
        `update iam.customers set full_name = $2, phone_number = $3, city = $4, address = $5,
         updated_at = clock_timestamp(), record_version = record_version + 1 where id = $1`,
        [context.customerId, fullName, phoneNumber, city, address || null],
      );
      return { address, city, fullName, phoneNumber };
    });
    return Response.json(profile, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return workflowProblem(error, request);
  }
}
