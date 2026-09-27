import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = /^\/(app(\/|$)|welcome$)/;

/**
 * In development, `localhost` and `127.0.0.1` are different sites to the browser, so a
 * session made on one is missing on the other, and Bluesky's local OAuth only accepts
 * 127.0.0.1. Send everyone to the address in APP_URL.
 */
function canonicalHost(req: NextRequest) {
  // Dev only: `next start` rewrites a same-port redirect to a relative one, which would loop.
  if (process.env.NODE_ENV === "production") return null;
  const want = new URL(process.env.APP_URL || "http://127.0.0.1:3000");
  // The Host header is what the browser typed; nextUrl reflects the address the server bound to.
  const [host, port] = (req.headers.get("host") ?? "").split(":");
  if (host !== "localhost" || want.hostname !== "127.0.0.1") return null;
  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `${want.protocol}//127.0.0.1${port ? `:${port}` : ""}`);
  return NextResponse.redirect(url);
}

/**
 * Optimistic redirect only: a missing cookie means signed out. Pages still verify
 * the session against the database, so a forged cookie gets nothing.
 */
export function proxy(req: NextRequest) {
  const moved = canonicalHost(req);
  if (moved) return moved;
  if (PROTECTED.test(req.nextUrl.pathname) && !getSessionCookie(req)) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon).*)"] };
