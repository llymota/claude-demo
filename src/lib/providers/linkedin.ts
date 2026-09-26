import "server-only";
import { env } from "../env";
import { fetchJson, form } from "./http";
import { NotAvailable, ReauthRequired, type Provider } from "./types";

export const LINKEDIN_SCOPES = ["openid", "profile", "email"];

export interface LinkedInCreds {
  accessToken: string;
  expiresAt: number;
  sub: string;
}

export async function linkedinExchangeCode(code: string, redirectUri: string) {
  const e = env();
  const t = await fetchJson<{ access_token: string; expires_in: number }>("https://www.linkedin.com/oauth/v2/accessToken", {
    op: "linkedin.token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: e.LINKEDIN_CLIENT_ID!, client_secret: e.LINKEDIN_CLIENT_SECRET! }),
  });
  return { accessToken: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
}

export async function linkedinUserInfo(accessToken: string) {
  return fetchJson<{ sub: string; name: string; picture?: string; email?: string }>("https://api.linkedin.com/v2/userinfo", {
    op: "linkedin.userinfo",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

const unavailable = (what: string) => async (): Promise<never> => {
  throw new NotAvailable(`LinkedIn does not offer ${what} to third-party apps`);
};

/**
 * LinkedIn's public API allows sign-in and profile only. Searching posts, reading
 * comments and follower lists require partner programs, so LinkedIn works in
 * manual mode: paste a post link into Rooms and log your reply.
 */
export const linkedin: Provider = {
  platform: "linkedin",
  capabilities: { rooms: false, post: false, archive: false, followerList: false, interactions: false },

  async getProfile(acct) {
    const c = acct.credentials as LinkedInCreds;
    if (c.expiresAt < Date.now()) throw new ReauthRequired();
    const u = await linkedinUserInfo(c.accessToken);
    return { externalId: u.sub, handle: u.name, displayName: u.name, avatarUrl: u.picture ?? null, bio: null, followers: 0, following: 0, pinnedPost: null };
  },
  searchRooms: async () => [],
  getOwnPosts: async () => [],
  getInteractions: async () => [],
  getRecentFollowers: async () => null,
  getEngagers: async () => new Map(),
  reply: unavailable("posting comments"),
  quote: unavailable("resharing posts"),
};
