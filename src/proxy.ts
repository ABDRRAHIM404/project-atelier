import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

const authenticatedProxy = clerkMiddleware();

function demoAuthenticationEnabled(): boolean {
  return (
    process.env.ALLOW_DEMO_AUTH === 'true' &&
    process.env.APP_ENV !== 'production' &&
    process.env.APP_ENV !== 'staging'
  );
}

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (demoAuthenticationEnabled()) return NextResponse.next();
  return authenticatedProxy(request, event);
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
};
