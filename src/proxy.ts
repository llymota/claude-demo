import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect only: a missing cookie means signed out. Pages still verify
 * the session against the database, so a forged cookie gets nothing.
 */
export function proxy(req: NextRequest) {
  if (!getSessionCookie(req)) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app/:path*", "/welcome"] };
