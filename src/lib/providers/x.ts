import "server-only";
import { env } from "../env";
import { fetchJson, form } from "./http";
import { ReauthRequired, type AccountRef, type CredentialUpdate, type Provider, type RawPost, type RawRoom } from "./types";

const API = "https://api.x.com/2";
export const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "follows.read", "like.read", "offline.access"];

export interface XCreds {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

interface XTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

function basicAuth() {
  return "Basic " + Buffer.from(`${env().X_CLIENT_ID}:${env().X_CLIENT_SECRET}`).toString("base64");
}

export async function xExchangeCode(code: string, verifier: string, redirectUri: string) {
  return fetchJson<XTokenResponse>(`${API}/oauth2/token`, {
    op: "x.token",
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier }),
  });
}

async function refresh(c: XCreds): Promise<XCreds> {
  try {
    const t = await fetchJson<XTokenResponse>(`${API}/oauth2/token`, {
      op: "x.refresh",
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: form({ grant_type: "refresh_token", refresh_token: c.refreshToken }),
    });
    return { ...c, accessToken: t.access_token, refreshToken: t.refresh_token ?? c.refreshToken, expiresAt: Date.now() + t.expires_in * 1000 };
  } catch {
    throw new ReauthRequired();
  }
}

/** X refresh tokens rotate on every use, so the new pair is saved before the call continues. */
async function token(acct: AccountRef, save: CredentialUpdate) {
  let c = acct.credentials as XCreds;
  if (c.expiresAt - Date.now() < 60_000) {
    c = await refresh(c);
    acct.credentials = c;
    await save(c, new Date(c.expiresAt));
  }
  return c;
}

async function get<T>(acct: AccountRef, save: CredentialUpdate, path: string, params: Record<string, string>, op: string) {
  const c = await token(acct, save);
  return fetchJson<T>(`${API}${path}?${new URLSearchParams(params)}`, { op, headers: { Authorization: `Bearer ${c.accessToken}` } });
}

async function post<T>(acct: AccountRef, save: CredentialUpdate, path: string, body: unknown, op: string) {
  const c = await token(acct, save);
  return fetchJson<T>(`${API}${path}`, {
    op,
    method: "POST",
    headers: { Authorization: `Bearer ${c.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

interface Metrics {
  retweet_count: number;
  reply_count: number;
  like_count: number;
  quote_count: number;
  bookmark_count?: number;
  impression_count?: number;
}
interface Tweet {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: Metrics;
  in_reply_to_user_id?: string;
  referenced_tweets?: { type: string; id: string }[];
}
interface XUser {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  description?: string;
  pinned_tweet_id?: string;
  public_metrics?: { followers_count: number; following_count: number };
}
interface Page<T> {
  data?: T[];
  includes?: { users?: XUser[]; tweets?: Tweet[] };
  meta?: { next_token?: string; result_count: number };
}

const tweetUrl = (username: string, id: string) => `https://x.com/${username}/status/${id}`;

export async function xMe(accessToken: string) {
  return fetchJson<{ data: XUser }>(`${API}/users/me?user.fields=public_metrics,profile_image_url,description,pinned_tweet_id`, {
    op: "x.me",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export const x: Provider = {
  platform: "x",
  capabilities: { rooms: true, post: true, archive: true, followerList: true, interactions: true },

  async getProfile(acct, save) {
    const res = await get<{ data: XUser; includes?: { tweets?: Tweet[] } }>(
      acct,
      save,
      "/users/me",
      { "user.fields": "public_metrics,profile_image_url,description,pinned_tweet_id", expansions: "pinned_tweet_id", "tweet.fields": "created_at" },
      "x.profile",
    );
    const u = res.data;
    const pinned = res.includes?.tweets?.[0];
    return {
      externalId: u.id,
      handle: u.username,
      displayName: u.name,
      avatarUrl: u.profile_image_url ?? null,
      bio: u.description ?? null,
      followers: u.public_metrics?.followers_count ?? 0,
      following: u.public_metrics?.following_count ?? 0,
      pinnedPost: pinned ? { text: pinned.text, postedAt: pinned.created_at, url: tweetUrl(u.username, pinned.id) } : null,
    };
  },

  async searchRooms(acct, query, save, limit) {
    const res = await get<Page<Tweet>>(
      acct,
      save,
      "/tweets/search/recent",
      {
        query: `(${query}) -is:retweet -is:reply`,
        max_results: String(Math.max(10, Math.min(100, limit))),
        "tweet.fields": "created_at,public_metrics,author_id",
        expansions: "author_id",
        "user.fields": "public_metrics,username,name",
      },
      "x.search",
    );
    const users = new Map((res.includes?.users ?? []).map((u) => [u.id, u]));
    const myId = (acct.credentials as XCreds).userId;
    return (res.data ?? [])
      .filter((t) => t.author_id !== myId)
      .map((t): RawRoom => {
        const u = users.get(t.author_id);
        return {
          externalId: t.id,
          url: tweetUrl(u?.username ?? "i", t.id),
          authorExternalId: t.author_id,
          authorHandle: u?.username ?? t.author_id,
          authorName: u?.name ?? u?.username ?? "Unknown",
          authorFollowers: u?.public_metrics?.followers_count ?? null,
          // X exposes no audience overlap; the sync engine estimates it from relative size.
          audienceOverlap: -1,
          text: t.text,
          postedAt: new Date(t.created_at),
          replyCount: t.public_metrics.reply_count,
        };
      });
  },

  async getOwnPosts(acct, save, limit) {
    const c = acct.credentials as XCreds;
    const out: RawPost[] = [];
    let next: string | undefined;
    while (out.length < limit) {
      const res = await get<Page<Tweet>>(
        acct,
        save,
        `/users/${c.userId}/tweets`,
        { max_results: "100", exclude: "retweets,replies", "tweet.fields": "created_at,public_metrics", ...(next ? { pagination_token: next } : {}) },
        "x.tweets",
      );
      for (const t of res.data ?? []) {
        out.push({
          externalId: t.id,
          url: tweetUrl(acct.handle, t.id),
          text: t.text,
          postedAt: new Date(t.created_at),
          likes: t.public_metrics.like_count,
          replies: t.public_metrics.reply_count,
          reposts: t.public_metrics.retweet_count + t.public_metrics.quote_count,
          saves: t.public_metrics.bookmark_count ?? 0,
          impressions: t.public_metrics.impression_count ?? null,
          isReply: false,
        });
      }
      next = res.meta?.next_token;
      if (!next) break;
    }
    return out.slice(0, limit);
  },

  async getInteractions(acct, save, since) {
    const c = acct.credentials as XCreds;
    const res = await get<Page<Tweet>>(
      acct,
      save,
      `/users/${c.userId}/mentions`,
      {
        max_results: "100",
        start_time: since.toISOString(),
        "tweet.fields": "created_at,in_reply_to_user_id,author_id",
        expansions: "author_id",
        "user.fields": "public_metrics,username,name,profile_image_url",
      },
      "x.mentions",
    );
    const users = new Map((res.includes?.users ?? []).map((u) => [u.id, u]));
    return (res.data ?? []).map((t) => {
      const u = users.get(t.author_id);
      return {
        person: {
          externalId: t.author_id,
          handle: u?.username ?? t.author_id,
          name: u?.name ?? u?.username ?? "Unknown",
          avatarUrl: u?.profile_image_url ?? null,
          followers: u?.public_metrics?.followers_count ?? null,
        },
        kind: t.in_reply_to_user_id === c.userId ? ("reply-to-me" as const) : ("mention" as const),
        occurredAt: new Date(t.created_at),
        externalRef: t.id,
      };
    });
  },

  async getRecentFollowers(acct, save, limit) {
    const c = acct.credentials as XCreds;
    try {
      const res = await get<Page<XUser>>(acct, save, `/users/${c.userId}/followers`, { max_results: String(Math.min(1000, limit)) }, "x.followers");
      return (res.data ?? []).map((u) => ({ externalId: u.id, handle: u.username }));
    } catch (err) {
      if ((err as Error).name === "NotAvailable") return null; // follower lists need a higher X API tier
      throw err;
    }
  },

  async getEngagers(acct, save, posts) {
    const out = new Map<string, Set<string>>();
    for (const p of posts) {
      const set = new Set<string>();
      for (const path of [`/tweets/${p.externalId}/liking_users`, `/tweets/${p.externalId}/retweeted_by`]) {
        try {
          const res = await get<Page<XUser>>(acct, save, path, { max_results: "100" }, "x.engagers");
          (res.data ?? []).forEach((u) => set.add(u.id));
        } catch (err) {
          if ((err as Error).name !== "NotAvailable") throw err;
        }
      }
      out.set(p.externalId, set);
    }
    return out;
  },

  async reply(acct, save, target, text) {
    const res = await post<{ data: { id: string } }>(acct, save, "/tweets", { text, reply: { in_reply_to_tweet_id: target.externalId } }, "x.reply");
    return { externalId: res.data.id, url: tweetUrl(acct.handle, res.data.id) };
  },

  async quote(acct, save, target, text) {
    const res = await post<{ data: { id: string } }>(acct, save, "/tweets", { text, quote_tweet_id: target.externalId }, "x.quote");
    return { externalId: res.data.id, url: tweetUrl(acct.handle, res.data.id) };
  },
};
