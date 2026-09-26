import "server-only";
import { env } from "../env";
import { fetchJson, form } from "./http";
import { ReauthRequired, type AccountRef, type CredentialUpdate, type Provider, type RawInteraction, type RawPost } from "./types";

const GRAPH = "https://graph.threads.net";
export const THREADS_SCOPES = [
  "threads_basic",
  "threads_content_publish",
  "threads_manage_replies",
  "threads_read_replies",
  "threads_keyword_search",
  "threads_manage_insights",
  "threads_manage_mentions",
];

export interface ThreadsCreds {
  accessToken: string;
  /** Long-lived tokens last 60 days and can be refreshed once they are 24 hours old. */
  expiresAt: number;
  issuedAt: number;
  userId: string;
}

export async function threadsExchangeCode(code: string, redirectUri: string) {
  const e = env();
  const short = await fetchJson<{ access_token: string; user_id: number | string }>(`${GRAPH}/oauth/access_token`, {
    op: "threads.token",
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({ client_id: e.THREADS_APP_ID!, client_secret: e.THREADS_APP_SECRET!, grant_type: "authorization_code", redirect_uri: redirectUri, code }),
  });
  const long = await fetchJson<{ access_token: string; expires_in: number }>(
    `${GRAPH}/access_token?${new URLSearchParams({ grant_type: "th_exchange_token", client_secret: e.THREADS_APP_SECRET!, access_token: short.access_token })}`,
    { op: "threads.exchange" },
  );
  return {
    accessToken: long.access_token,
    expiresAt: Date.now() + long.expires_in * 1000,
    issuedAt: Date.now(),
    userId: String(short.user_id),
  } satisfies ThreadsCreds;
}

async function token(acct: AccountRef, save: CredentialUpdate) {
  let c = acct.credentials as ThreadsCreds;
  if (c.expiresAt < Date.now()) throw new ReauthRequired();
  const sevenDays = 7 * 86_400_000;
  if (c.expiresAt - Date.now() < sevenDays && Date.now() - c.issuedAt > 86_400_000) {
    const r = await fetchJson<{ access_token: string; expires_in: number }>(
      `${GRAPH}/refresh_access_token?${new URLSearchParams({ grant_type: "th_refresh_token", access_token: c.accessToken })}`,
      { op: "threads.refresh" },
    );
    c = { ...c, accessToken: r.access_token, expiresAt: Date.now() + r.expires_in * 1000, issuedAt: Date.now() };
    acct.credentials = c;
    await save(c, new Date(c.expiresAt));
  }
  return c;
}

async function get<T>(acct: AccountRef, save: CredentialUpdate, path: string, params: Record<string, string>, op: string) {
  const c = await token(acct, save);
  return fetchJson<T>(`${GRAPH}/v1.0${path}?${new URLSearchParams({ ...params, access_token: c.accessToken })}`, { op });
}

async function publish(acct: AccountRef, save: CredentialUpdate, params: Record<string, string>, op: string) {
  const c = await token(acct, save);
  const create = await fetchJson<{ id: string }>(`${GRAPH}/v1.0/me/threads?${new URLSearchParams({ media_type: "TEXT", ...params, access_token: c.accessToken })}`, {
    op: `${op}.create`,
    method: "POST",
  });
  const done = await fetchJson<{ id: string }>(`${GRAPH}/v1.0/me/threads_publish?${new URLSearchParams({ creation_id: create.id, access_token: c.accessToken })}`, {
    op: `${op}.publish`,
    method: "POST",
  });
  const meta = await get<{ permalink?: string }>(acct, save, `/${done.id}`, { fields: "permalink" }, `${op}.permalink`);
  return { externalId: done.id, url: meta.permalink ?? `https://www.threads.net/@${acct.handle}` };
}

interface Media {
  id: string;
  text?: string;
  permalink?: string;
  timestamp: string;
  username?: string;
  is_reply?: boolean;
}
interface List<T> {
  data: T[];
  paging?: { cursors?: { after?: string } };
}

export const threads: Provider = {
  platform: "threads",
  // Threads does not list followers or expose other people's follower counts.
  capabilities: { rooms: true, post: true, archive: true, followerList: false, interactions: true },

  async getProfile(acct, save) {
    const me = await get<{ id: string; username: string; name?: string; threads_profile_picture_url?: string; threads_biography?: string }>(
      acct,
      save,
      "/me",
      { fields: "id,username,name,threads_profile_picture_url,threads_biography" },
      "threads.me",
    );
    const insights = await get<{ data: { name: string; total_value?: { value: number } }[] }>(acct, save, `/${me.id}/threads_insights`, { metric: "followers_count" }, "threads.followers").catch(
      () => ({ data: [] }),
    );
    return {
      externalId: me.id,
      handle: me.username,
      displayName: me.name ?? me.username,
      avatarUrl: me.threads_profile_picture_url ?? null,
      bio: me.threads_biography ?? null,
      followers: insights.data.find((d) => d.name === "followers_count")?.total_value?.value ?? 0,
      following: 0,
      pinnedPost: null,
    };
  },

  async searchRooms(acct, query, save, limit) {
    const res = await get<List<Media>>(
      acct,
      save,
      "/keyword_search",
      { q: query, search_type: "RECENT", fields: "id,text,permalink,timestamp,username,is_reply", limit: String(Math.min(50, limit)) },
      "threads.search",
    );
    return res.data
      .filter((m) => !m.is_reply && m.username && m.username !== acct.handle)
      .map((m) => ({
        externalId: m.id,
        url: m.permalink ?? `https://www.threads.net/@${m.username}`,
        authorExternalId: m.username!,
        authorHandle: m.username!,
        authorName: m.username!,
        authorFollowers: null,
        audienceOverlap: -1,
        text: m.text ?? "",
        postedAt: new Date(m.timestamp),
        replyCount: 0,
      }));
  },

  async getOwnPosts(acct, save, limit) {
    const res = await get<List<Media>>(acct, save, "/me/threads", { fields: "id,text,permalink,timestamp,is_reply", limit: String(Math.min(100, limit)) }, "threads.posts");
    const posts = res.data.filter((m) => !m.is_reply && m.text);
    const out: RawPost[] = [];
    for (const m of posts.slice(0, limit)) {
      const ins = await get<{ data: { name: string; values?: { value: number }[] }[] }>(
        acct,
        save,
        `/${m.id}/insights`,
        { metric: "views,likes,replies,reposts,quotes" },
        "threads.insights",
      ).catch(() => ({ data: [] }));
      const v = (n: string) => ins.data.find((d) => d.name === n)?.values?.[0]?.value ?? 0;
      out.push({
        externalId: m.id,
        url: m.permalink ?? "",
        text: m.text ?? "",
        postedAt: new Date(m.timestamp),
        likes: v("likes"),
        replies: v("replies"),
        reposts: v("reposts") + v("quotes"),
        saves: 0,
        impressions: v("views") || null,
        isReply: false,
      });
    }
    return out;
  },

  async getInteractions(acct, save, since) {
    const out: RawInteraction[] = [];
    const mentions = await get<List<Media>>(acct, save, "/me/mentions", { fields: "id,username,timestamp" }, "threads.mentions").catch(() => ({ data: [] as Media[] }));
    const recent = await get<List<Media>>(acct, save, "/me/threads", { fields: "id,timestamp", limit: "10" }, "threads.recent");
    const replies: Media[] = [];
    for (const m of recent.data) {
      const r = await get<List<Media>>(acct, save, `/${m.id}/replies`, { fields: "id,username,timestamp" }, "threads.replies").catch(() => ({ data: [] as Media[] }));
      replies.push(...r.data);
    }
    for (const [list, kind] of [
      [mentions.data, "mention"],
      [replies, "reply-to-me"],
    ] as const) {
      for (const m of list) {
        if (!m.username || m.username === acct.handle || new Date(m.timestamp) < since) continue;
        out.push({
          person: { externalId: m.username, handle: m.username, name: m.username, avatarUrl: null, followers: null },
          kind,
          occurredAt: new Date(m.timestamp),
          externalRef: m.id,
        });
      }
    }
    return out;
  },

  async getRecentFollowers() {
    return null;
  },

  async getEngagers(acct, save, posts) {
    const out = new Map<string, Set<string>>();
    for (const p of posts) {
      const r = await get<List<Media>>(acct, save, `/${p.externalId}/replies`, { fields: "username" }, "threads.engagers").catch(() => ({ data: [] as Media[] }));
      out.set(p.externalId, new Set(r.data.map((m) => m.username!).filter(Boolean)));
    }
    return out;
  },

  async reply(acct, save, target, text) {
    return publish(acct, save, { text, reply_to_id: target.externalId }, "threads.reply");
  },

  async quote(acct, save, target, text) {
    return publish(acct, save, { text, quote_post_id: target.externalId }, "threads.quote");
  },
};
