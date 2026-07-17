import { z } from 'zod';

export const dynamic = 'force-dynamic';

const inputSchema = z.object({ role: z.enum(['customer', 'manager']) });

function enabled(): boolean {
  return (
    process.env.ALLOW_DEMO_AUTH === 'true' &&
    process.env.APP_ENV !== 'production' &&
    process.env.APP_ENV !== 'staging'
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!enabled()) return new Response(null, { status: 404 });

  const parsed = inputSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return Response.json({ code: 'VALIDATION_FAILED' }, { status: 422 });
  }

  return Response.json(
    { role: parsed.data.role },
    {
      headers: {
        'Cache-Control': 'no-store',
        'Set-Cookie': `atelier_demo_actor=${parsed.data.role}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      },
    },
  );
}
