import { createProblemDetails, type ProblemCode } from '../../../../shared/errors';
import type { Identifier } from '../../../../shared/kernel';

export function identityProblemResponse(
  code: ProblemCode,
  request: Request,
  correlationId: Identifier<'Correlation'>,
): Response {
  const problem = createProblemDetails(
    { code },
    { correlationId, instance: new URL(request.url).pathname },
  );
  return Response.json(problem, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'application/problem+json',
      'X-Correlation-ID': correlationId,
    },
    status: problem.status,
  });
}
