import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

const AUTH_PAGES = ['/sign-in', '/sign-up'];
const PUBLIC_PAGES = [...AUTH_PAGES, '/status'];

const matches = (pathname: string, pages: string[]) =>
  pages.some((page) => pathname === page || pathname.startsWith(`${page}/`));

/**
 * Optimistic redirect based on the presence of the session cookie. The API
 * still validates the session on every request; an expired cookie ends in a
 * 401 that sends the user back to sign in.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = getSessionCookie(request) !== null;

  if (!hasSession && !matches(pathname, PUBLIC_PAGES)) {
    const url = new URL('/sign-in', request.url);
    if (pathname !== '/') url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  if (hasSession && matches(pathname, AUTH_PAGES)) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)'],
};
