import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const publicRoutes = ['/login'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  console.log('[Middleware]', { pathname, hasToken: !!token });

  // Allow access to public routes
  if (publicRoutes.includes(pathname)) {
    // If already logged in and trying to access login, redirect to home
    if (token && pathname === '/login') {
      console.log('[Middleware] Redirecting from login to /');
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Redirect to login if no token and not on a public route
  if (!token) {
    console.log('[Middleware] No token, redirecting to login');
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  console.log('[Middleware] Allowing access to', pathname);
  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
