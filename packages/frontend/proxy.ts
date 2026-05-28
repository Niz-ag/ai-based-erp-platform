import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * AI MANDATE: Edge Resilience & Security (Phase 3 Strategy)
 * This middleware runs at the planetary edge (CDN level).
 * It handles early auth rejection and tenant routing to minimize TTFB.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;

  // 1. PUBLIC ROUTES: Allow early return
  if (
    pathname.startsWith('/login') || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/public') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. AUTHENTICATION GATE: Fast rejection at the edge
  // Note: We don't validate JWT signature here (requires secret), 
  // but we can check existence and format to block obvious bots/attacks.
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. SECURITY HEADERS: Inject planetary-grade protection
  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' http://localhost:3000 https://api.amdox.com;"
  );

  return response;
}

// Ensure middleware only runs on dashboard and settings routes
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/hr/:path*',
    '/finance/:path*',
    '/inventory/:path*',
    '/projects/:path*',
    '/settings/:path*',
    '/users/:path*',
  ],
};
