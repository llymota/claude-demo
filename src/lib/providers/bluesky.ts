import "server-only";
import { Agent, RichText, type AppBskyFeedDefs } from "@atproto/api";
import { blueskyClient } from "./bluesky-oauth";
import { ReauthRequired, type AccountRef, type Provider, type RawPost, type RawRoom } from "./types";

/** Bluesky stores only the DID in our credentials column; the OAuth session lives in oauth_store. */
interface BskyCreds {
  did: string;
}

async function agentFor(acct: AccountRef) {
  const { did } = acct.credentials as BskyCreds;
  try {
    const session = await (await blueskyClient()).restore(did);
    return new Agent(session);
  } catch {
    throw new ReauthRequired();
  }
}

export function postUrl(handle: string, uri: string) {
  return `https://bsky.app/profile/${handle}/post/${uri.split("/").pop()}`;
}

type PostRecord = { text?: string; createdAt?: string; reply?: { root: { uri: string; cid: string } } };

function record(p: AppBskyFeedDefs.PostView) {
  return p.record as PostRecord;
}

function refFor(p: AppBskyFeedDefs.PostView) {
  const r = record(p);
  return { uri: p.uri, cid: p.cid, rootUri: r.reply?.root.uri ?? p.uri, rootCid: r.reply?.root.cid ?? p.cid };
}

export const bluesky: Provider = {
  platform: "bluesky",
  capabilities: { rooms: true, post: true, archive: true, followerList: true, interactions: true },

  async getProfile(acct) {
    const agent = await agentFor(acct);
    const { data } = await agent.getProfile({ actor: agent.assertDid });
    let pinnedPost = null;
    if (data.pinnedPost) {
      const pinned = await agent.getPosts({ uris: [data.pinnedPost.uri] });
      const p = pinned.data.posts[0];
      if (p) pinnedPost = { text: record(p).text ?? "", postedAt: record(p).createdAt ?? p.indexedAt, url: postUrl(data.handle, p.uri) };
    }
    return {
      externalId: data.did,
      handle: data.handle,
      displayName: data.displayName ?? null,
      avatarUrl: data.avatar ?? null,
      bio: data.description ?? null,
      followers: data.followersCount ?? 0,
      following: data.followsCount ?? 0,
      pinnedPost,
    };
  },

  async searchRooms(acct, query, _save, limit) {
    const agent = await agentFor(acct);
    const since = new Date(Date.now() - 6 * 3600_000).toISOString();
    const { data } = await agent.app.bsky.feed.searchPosts({ q: query, sort: "latest", since, limit: Math.min(100, limit) });
    const posts = data.posts.filter((p) => !record(p).reply && p.author.did !== agent.assertDid);
    if (posts.length === 0) return [];

    const me = await agent.getProfile({ actor: agent.assertDid });
    const myFollowing = Math.max(1, me.data.followsCount ?? 1);
    const dids = [...new Set(posts.map((p) => p.author.did))];
    const profiles = new Map<string, { followers: number; known: number; followedBy: boolean }>();
    for (let i = 0; i < dids.length; i += 25) {
      const res = await agent.getProfiles({ actors: dids.slice(i, i + 25) });
      for (const pr of res.data.profiles) {
        profiles.set(pr.did, { followers: pr.followersCount ?? 0, known: pr.viewer?.knownFollowers?.count ?? 0, followedBy: Boolean(pr.viewer?.followedBy) });
      }
    }

    return posts.map((p): RawRoom => {
      const prof = profiles.get(p.author.did);
      // People you follow who also follow the author: a proxy for how much of the room already knows you.
      const overlap = prof ? Math.min(1, (prof.known / myFollowing) * 1.5 + (prof.followedBy ? 0.2 : 0)) : 0;
      return {
        externalId: p.uri,
        url: postUrl(p.author.handle, p.uri),
        replyRef: refFor(p),
        authorExternalId: p.author.did,
        authorHandle: p.author.handle,
        authorName: p.author.displayName || p.author.handle,
        authorFollowers: prof?.followers ?? null,
        audienceOverlap: overlap,
        text: record(p).text ?? "",
        postedAt: new Date(record(p).createdAt ?? p.indexedAt),
        replyCount: p.replyCount ?? 0,
      };
    });
  },

  async getOwnPosts(acct, _save, limit) {
    const agent = await agentFor(acct);
    const out: RawPost[] = [];
    let cursor: string | undefined;
    while (out.length < limit) {
      const { data } = await agent.getAuthorFeed({ actor: agent.assertDid, filter: "posts_no_replies", limit: 100, cursor });
      for (const item of data.feed) {
        if (item.reason) continue; // reposts of other people
        const p = item.post;
        out.push({
          externalId: p.uri,
          url: postUrl(p.author.handle, p.uri),
          replyRef: refFor(p),
          text: record(p).text ?? "",
          postedAt: new Date(record(p).createdAt ?? p.indexedAt),
          likes: p.likeCount ?? 0,
          replies: p.replyCount ?? 0,
          reposts: (p.repostCount ?? 0) + (p.quoteCount ?? 0),
          saves: p.bookmarkCount ?? 0,
          impressions: null,
          isReply: Boolean(record(p).reply),
        });
      }
      if (!data.cursor || data.feed.length === 0) break;
      cursor = data.cursor;
    }
    return out.slice(0, limit);
  },

  async getInteractions(acct, _save, since) {
    const agent = await agentFor(acct);
    const { data } = await agent.listNotifications({ limit: 100 });
    const kinds = { reply: "reply-to-me", mention: "mention", quote: "mention", repost: "repost", like: "like" } as const;
    return data.notifications
      .filter((n) => n.reason in kinds && new Date(n.indexedAt) >= since)
      .map((n) => ({
        person: { externalId: n.author.did, handle: n.author.handle, name: n.author.displayName || n.author.handle, avatarUrl: n.author.avatar ?? null, followers: null },
        kind: kinds[n.reason as keyof typeof kinds],
        occurredAt: new Date(n.indexedAt),
        externalRef: n.uri,
      }));
  },

  async getRecentFollowers(acct, _save, limit) {
    const agent = await agentFor(acct);
    const { data } = await agent.getFollowers({ actor: agent.assertDid, limit: Math.min(100, limit) });
    return data.followers.map((f) => ({ externalId: f.did, handle: f.handle }));
  },

  async getEngagers(acct, _save, posts) {
    const agent = await agentFor(acct);
    const out = new Map<string, Set<string>>();
    for (const p of posts) {
      const set = new Set<string>();
      const [likes, reposts, thread] = await Promise.all([
        agent.getLikes({ uri: p.externalId, limit: 100 }).catch(() => null),
        agent.getRepostedBy({ uri: p.externalId, limit: 100 }).catch(() => null),
        agent.getPostThread({ uri: p.externalId, depth: 1 }).catch(() => null),
      ]);
      likes?.data.likes.forEach((l) => set.add(l.actor.did));
      reposts?.data.repostedBy.forEach((r) => set.add(r.did));
      const replies = (thread?.data.thread as { replies?: { post?: AppBskyFeedDefs.PostView }[] } | undefined)?.replies ?? [];
      replies.forEach((r) => r.post && set.add(r.post.author.did));
      out.set(p.externalId, set);
    }
    return out;
  },

  async reply(acct, _save, target, text) {
    const agent = await agentFor(acct);
    const ref = target.replyRef ?? {};
    if (!ref.cid) throw new Error("This post is missing the reference needed to reply");
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    const res = await agent.post({
      text: rt.text,
      facets: rt.facets,
      reply: { root: { uri: ref.rootUri ?? target.externalId, cid: ref.rootCid ?? ref.cid }, parent: { uri: target.externalId, cid: ref.cid } },
      createdAt: new Date().toISOString(),
    });
    return { externalId: res.uri, url: postUrl(acct.handle, res.uri) };
  },

  async quote(acct, _save, target, text) {
    const agent = await agentFor(acct);
    const cid = target.replyRef?.cid;
    if (!cid) throw new Error("This post is missing the reference needed to quote it");
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    const res = await agent.post({
      text: rt.text,
      facets: rt.facets,
      embed: { $type: "app.bsky.embed.record", record: { uri: target.externalId, cid } },
      createdAt: new Date().toISOString(),
    });
    return { externalId: res.uri, url: postUrl(acct.handle, res.uri) };
  },
};
