import { handleCurrentIdentityRequest } from '../../../../platform/access-and-identity';

export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return handleCurrentIdentityRequest(request);
}
