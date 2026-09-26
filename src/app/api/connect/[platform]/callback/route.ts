import { Agent } from "@atproto/api";
import { after, NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { AccountLimitReached, saveAccount } from "@/lib/accounts";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { finishConnect, redirectUri } from "@/lib/oauth-state";
import { bluesky } from "@/lib/providers/bluesky";
import { BLUESKY_SCOPE, blueskyClient } from "@/lib/providers/bluesky-oauth";
import { linkedinExchangeCode, linkedinUserInfo, LINKEDIN_SCOPES } from "@/lib/providers/linkedin";
import { threads, threadsExchangeCode, THREADS_SCOPES } from "@/lib/providers/threads";
import type { AccountRef, Platform, ProfileData } from "@/lib/providers/types";
import { x, xExchangeCode, X_SCOPES } from "@/lib/providers/x";
import { getSession } from "@/lib/session";
import { syncAccount } from "@/lib/sync";

const noopSave = async () => {};

async function done(req: NextRequest, userId: string, params: Record<string, string>) {
  const ws = await db.query.workspace.findFirst({ where: eq(schema.workspace.userId, userId), columns: { onboardedAt: true } });
  const base = ws?.onboardedAt ? "/app/settings/accounts" : "/welcome";
  return NextResponse.redirect(new URL(`${base}?${new URLSearchParams({ ...(ws?.onboardedAt ? {} : { step: "connect" }), ...params })}`, env().APP_URL));
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/connect/[platform]/callback">) {
  const { platform: p } = await ctx.params;
  const platform = p as Platform;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/sign-in", env().APP_URL));
  const q = req.nextUrl.searchParams;

  if (q.get("error")) return done(req, session.user.id, { error: "You cancelled the connection" });

  const state = await finishConnect(platform, q.get("state"), session.user.id);
  if (!state) return done(req, session.user.id, { error: "The connection link expired. Try again." });

  try {
    let profile: ProfileData;
    let credentials: unknown;
    let expiresAt: Date | null = null;
    let scopes: string;

    switch (platform) {
      case "bluesky": {
        const { session: oauth } = await (await blueskyClient()).callback(q);
        const agent = new Agent(oauth);
        credentials = { did: agent.assertDid };
        profile = await bluesky.getProfile({ id: "", externalId: agent.assertDid, handle: "", credentials }, noopSave);
        scopes = BLUESKY_SCOPE;
        break;
      }
      case "x": {
        const t = await xExchangeCode(q.get("code") ?? "", state.verifier, redirectUri("x"));
        expiresAt = new Date(Date.now() + t.expires_in * 1000);
        const partial = { accessToken: t.access_token, refreshToken: t.refresh_token ?? "", expiresAt: expiresAt.getTime(), userId: "" };
        const ref: AccountRef = { id: "", externalId: "", handle: "", credentials: partial };
        profile = await x.getProfile(ref, noopSave);
        credentials = { ...partial, userId: profile.externalId };
        scopes = t.scope ?? X_SCOPES.join(" ");
        break;
      }
      case "threads": {
        const c = await threadsExchangeCode(q.get("code") ?? "", redirectUri("threads"));
        credentials = c;
        expiresAt = new Date(c.expiresAt);
        profile = await threads.getProfile({ id: "", externalId: c.userId, handle: "", credentials: c }, noopSave);
        scopes = THREADS_SCOPES.join(",");
        break;
      }
      case "linkedin": {
        const t = await linkedinExchangeCode(q.get("code") ?? "", redirectUri("linkedin"));
        const u = await linkedinUserInfo(t.accessToken);
        credentials = { ...t, sub: u.sub };
        expiresAt = new Date(t.expiresAt);
        profile = { externalId: u.sub, handle: u.name, displayName: u.name, avatarUrl: u.picture ?? null, bio: null, followers: 0, following: 0, pinnedPost: null };
        scopes = LINKEDIN_SCOPES.join(" ");
        break;
      }
      default:
        return done(req, session.user.id, { error: "Unknown platform" });
    }

    const account = await saveAccount({ userId: session.user.id, platform, profile, credentials, tokenExpiresAt: expiresAt, scopes });
    // First sync runs after the redirect so the user isn't kept waiting.
    after(() => syncAccount(account.id).catch((err) => log.error("sync.initial_failed", { accountId: account.id, error: err })));
    return done(req, session.user.id, { connected: platform });
  } catch (err) {
    if (err instanceof AccountLimitReached) return done(req, session.user.id, { error: `${err.message}. Upgrade to connect more.` });
    log.error("connect.callback_failed", { platform, error: err });
    return done(req, session.user.id, { error: "Something went wrong while connecting. Try again." });
  }
}
