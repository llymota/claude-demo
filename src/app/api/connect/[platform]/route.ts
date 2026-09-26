import { NextResponse, type NextRequest } from "next/server";
import { pkceChallenge } from "@/lib/crypto";
import { env, features } from "@/lib/env";
import { log } from "@/lib/log";
import { beginConnect, redirectUri } from "@/lib/oauth-state";
import { blueskyClient } from "@/lib/providers/bluesky-oauth";
import { LINKEDIN_SCOPES } from "@/lib/providers/linkedin";
import { THREADS_SCOPES } from "@/lib/providers/threads";
import { X_SCOPES } from "@/lib/providers/x";
import { getSession } from "@/lib/session";

const PLATFORMS = ["bluesky", "x", "threads", "linkedin"] as const;

function back(req: NextRequest, error: string) {
  const from = req.nextUrl.searchParams.get("from") === "welcome" ? "/welcome?step=connect&" : "/app/settings/accounts?";
  return NextResponse.redirect(new URL(`${from}error=${encodeURIComponent(error)}`, env().APP_URL));
}

/** Starts the OAuth flow for connecting a social account. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/connect/[platform]">) {
  const { platform: p } = await ctx.params;
  const platform = PLATFORMS.find((x) => x === p);
  if (!platform) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/sign-in", env().APP_URL));
  if (!features[platform]()) return back(req, `${platform} is not configured on this server`);

  const s = await beginConnect(session.user.id, platform);
  const e = env();

  switch (platform) {
    case "bluesky": {
      const handle = req.nextUrl.searchParams.get("handle")?.trim().replace(/^@/, "");
      if (!handle) return back(req, "Enter your Bluesky handle first");
      try {
        const url = await (await blueskyClient()).authorize(handle, { state: s.state });
        return NextResponse.redirect(url);
      } catch (err) {
        log.warn("connect.bluesky_authorize_failed", { error: err });
        return back(req, "We couldn't find that Bluesky handle");
      }
    }
    case "x": {
      const url = new URL("https://x.com/i/oauth2/authorize");
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: e.X_CLIENT_ID!,
        redirect_uri: redirectUri("x"),
        scope: X_SCOPES.join(" "),
        state: s.state,
        code_challenge: pkceChallenge(s.verifier),
        code_challenge_method: "S256",
      }).toString();
      return NextResponse.redirect(url);
    }
    case "threads": {
      const url = new URL("https://threads.net/oauth/authorize");
      url.search = new URLSearchParams({
        client_id: e.THREADS_APP_ID!,
        redirect_uri: redirectUri("threads"),
        scope: THREADS_SCOPES.join(","),
        response_type: "code",
        state: s.state,
      }).toString();
      return NextResponse.redirect(url);
    }
    case "linkedin": {
      const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: e.LINKEDIN_CLIENT_ID!,
        redirect_uri: redirectUri("linkedin"),
        scope: LINKEDIN_SCOPES.join(" "),
        state: s.state,
      }).toString();
      return NextResponse.redirect(url);
    }
  }
}
