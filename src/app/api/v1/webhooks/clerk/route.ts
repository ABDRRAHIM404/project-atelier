import { handleClerkWebhookRequest } from '../../../../../platform/access-and-identity';

export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleClerkWebhookRequest(request);
}
