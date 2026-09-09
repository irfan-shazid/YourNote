import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic route protection.
 *
 * This only checks that a session cookie is present - it never validates it,
 * because middleware runs on the edge without database access. Real
 * authorisation happens twice behind it: the page reads the session on the
 * server, and the Go API re-checks the session and the role on every request.
 * The purpose here is simply to avoid rendering a protected page for an
 * obviously signed-out visitor.
 *
 * The cookie is read by name rather than with `getSessionCookie` from
 * better-auth/cookies: that helper pulls `jose` into the edge bundle, which
 * emits unsupported-API warnings for code this path never executes.
 */
const SESSION_COOKIES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

const protectedRoutes = ["/dashboard", "/bookmarks", "/admin", "/notes/new"];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => Boolean(request.cookies.get(name)?.value));
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const needsSession = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!needsSession) return NextResponse.next();

  if (!hasSessionCookie(request)) {
    const signIn = new URL("/sign-in", request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the auth handler and static files.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
