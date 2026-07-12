import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Check if the user has an active session cookie
  const sessionCookie = request.cookies.get('planbro_session');

  if (!sessionCookie) {
    // Redirect to login if unauthenticated
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

// Specify which routes should be protected
export const config = {
  matcher: [
    '/plan/:path*',
    '/profile',
    '/recommend',
    '/quick-trip',
    '/stats'
  ],
};
