import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Handle authenticated routes here
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login") ||
                      req.nextUrl.pathname.startsWith("/register") ||
                      req.nextUrl.pathname.startsWith("/verify-email");

    if (isAuthPage) {
      if (isAuth) {
        return NextResponse.redirect(new URL("/", req.url));
      }
      return null;
    }

    if (!isAuth) {
      let from = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        from += req.nextUrl.search;
      }

      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
      );
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
  }
);

// Protect all routes except public ones
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/auth/* (authentication endpoints)
     * - /login (login page)
     * - /register (registration page)
     * - /verify-email (email verification page)
     * - /_next/static (static files)
     * - /_next/image (image optimization files)
     * - /favicon.ico (favicon file)
     * - /images/* (public images)
     */
    // "/((?!api/auth|login|register|verify-email|_next/static|_next/image|favicon.ico|images).*)"
    "/((?!api/auth|api/webhooks/stripe|login|register|verify-email|_next/static|_next/image|favicon.ico|images).*)"

  ]
}; 