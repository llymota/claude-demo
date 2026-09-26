import "server-only";
import { and, asc, desc, eq, gte, inArray, isNotNull, lt, notInArray, or, sql } from "drizzle-orm";
import { credentialSaver, planFor, toRef } from "./accounts";
import { attributeFollower, followDelta, type AttributionContext } from "./attribution";
import { PLANS } from "./billing/plans";
import { db, schema } from "./db";
import { log } from "./log";
import { providerFor } from "./providers";
import { NotAvailable, RateLimited, ReauthRequired, type AccountRef, type CredentialUpdate, type Provider } from "./providers/types";
import { classifyCircle, estimateOverlap, leverage, searchQueries, tagTopics, topicWeights, velocity, warmth, type InteractionLite } from "./scoring";

type Account = typeof schema.socialAccount.$inferSelect;
type Stats = Record<string, number>;

const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY));

async function step(name: string, stats: Stats, fn: () => Promise<number | void>) {
  try {
    const n = await fn();
    if (typeof n === "number") stats[name] = n;
  } catch (err) {
    // Auth and rate limits stop the whole sync; anything else only skips this step.
    if (err instanceof ReauthRequired || err instanceof RateLimited) throw err;
    stats[`${name}_failed`] = 1;
    if (!(err instanceof NotAvailable)) log.warn("sync.step_failed", { step: name, error: err });
  }
}

async function interactionsByPerson(personIds: string[]) {
  if (personIds.length === 0) return new Map<string, InteractionLite[]>();
  const rows = await db
    .select({ personId: schema.interaction.personId, kind: schema.interaction.kind, inbound: schema.interaction.inbound, occurredAt: schema.interaction.occurredAt })
    .from(schema.interaction)
    .where(and(inArray(schema.interaction.personId, personIds), gte(schema.interaction.occurredAt, new Date(Date.now() - 180 * DAY))));
  const map = new Map<string, InteractionLite[]>();
  for (const r of rows) {
    const list = map.get(r.personId) ?? [];
    list.push({ kind: r.kind, inbound: r.inbound, daysAgo: daysAgo(r.occurredAt) });
    map.set(r.personId, list);
  }
  return map;
}

async function syncProfile(acct: Account, provider: Provider, ref: AccountRef, save: CredentialUpdate) {
  const p = await provider.getProfile(ref, save);
  await db
    .update(schema.socialAccount)
    .set({ handle: p.handle, displayName: p.displayName, avatarUrl: p.avatarUrl, bio: p.bio, followers: p.followers, following: p.following, pinnedPost: p.pinnedPost })
    .where(eq(schema.socialAccount.id, acct.id));
  await db
    .insert(schema.followerSnapshot)
    .values({ accountId: acct.id, day: today(), followers: p.followers })
    .onConflictDoUpdate({ target: [schema.followerSnapshot.accountId, schema.followerSnapshot.day], set: { followers: p.followers } });
  return p;
}

async function syncRooms(acct: Account, provider: Provider, ref: AccountRef, save: CredentialUpdate, myFollowers: number) {
  const ws = await db.query.workspace.findFirst({ where: eq(schema.workspace.userId, acct.userId) });
  const topics = ws?.topics ?? [];
  if (topics.length === 0) return 0;
  const weights = topicWeights(topics);
  const now = new Date();

  const seen = new Map<string, Awaited<ReturnType<Provider["searchRooms"]>>[number]>();
  for (const q of searchQueries(topics)) {
    for (const r of await provider.searchRooms(ref, q, save, 40)) seen.set(r.externalId, r);
  }
  const raw = [...seen.values()].filter((r) => now.getTime() - r.postedAt.getTime() < DAY);
  if (raw.length === 0) return 0;

  const existing = await db.query.room.findMany({
    where: and(eq(schema.room.accountId, acct.id), inArray(schema.room.externalId, raw.map((r) => r.externalId))),
  });
  const prevById = new Map(existing.map((e) => [e.externalId, e]));
  const people = await db.query.person.findMany({
    where: and(eq(schema.person.accountId, acct.id), inArray(schema.person.externalId, [...new Set(raw.map((r) => r.authorExternalId))])),
  });
  const personByExt = new Map(people.map((p) => [p.externalId, p]));
  const ints = await interactionsByPerson(people.map((p) => p.id));

  let n = 0;
  for (const r of raw) {
    const tagged = tagTopics(r.text, topics);
    if (tagged.length === 0) continue; // matched a keyword inside a word or a hashtag we don't track
    const prev = prevById.get(r.externalId);
    const v = velocity({ replies: r.replyCount, at: now, postedAt: r.postedAt }, prev ? { replies: prev.replyCount, at: prev.fetchedAt } : null);
    const overlap = r.audienceOverlap >= 0 ? r.audienceOverlap : estimateOverlap(myFollowers, r.authorFollowers);
    const person = personByExt.get(r.authorExternalId);
    const lev = leverage(
      {
        topics: tagged,
        ageMinutes: (now.getTime() - r.postedAt.getTime()) / 60_000,
        replies: r.replyCount,
        velocity: v,
        audienceOverlap: overlap,
        authorFollowers: r.authorFollowers,
        knownWarmth: person ? warmth(ints.get(person.id) ?? []) : null,
      },
      { weights, myFollowers },
    );
    const values = {
      accountId: acct.id,
      externalId: r.externalId,
      replyRef: r.replyRef ?? null,
      url: r.url,
      authorExternalId: r.authorExternalId,
      authorHandle: r.authorHandle,
      authorName: r.authorName,
      authorFollowers: r.authorFollowers,
      text: r.text,
      topics: tagged,
      postedAt: r.postedAt,
      replyCount: r.replyCount,
      velocity: v,
      audienceOverlap: overlap,
      score: lev.score,
      breakdown: { fit: lev.fit, early: lev.early, reach: lev.reach, rapport: lev.rapport, windowMinutes: lev.windowMinutes },
      fetchedAt: now,
    };
    await db
      .insert(schema.room)
      .values({ ...values, status: lev.windowMinutes > 0 ? "open" : "expired" })
      .onConflictDoUpdate({
        target: [schema.room.accountId, schema.room.externalId],
        // Keep "replied" and "dismissed"; only open rooms can expire.
        set: { ...values, status: sql`case when ${schema.room.status} = 'open' and ${lev.windowMinutes} = 0 then 'expired'::room_status else ${schema.room.status} end` },
      });
    n++;
  }

  await db
    .update(schema.room)
    .set({ status: "expired" })
    .where(and(eq(schema.room.accountId, acct.id), eq(schema.room.status, "open"), lt(schema.room.postedAt, new Date(now.getTime() - DAY))));
  return n;
}

async function upsertPerson(acct: Account, p: { externalId: string; handle: string; name: string; avatarUrl: string | null; followers: number | null }) {
  const followers = p.followers ?? 0;
  const [row] = await db
    .insert(schema.person)
    .values({ accountId: acct.id, externalId: p.externalId, handle: p.handle, name: p.name, avatarUrl: p.avatarUrl, followers, baselineFollowers: followers, circle: "peer" })
    .onConflictDoUpdate({
      target: [schema.person.accountId, schema.person.externalId],
      set: { handle: p.handle, name: p.name, avatarUrl: p.avatarUrl, ...(p.followers !== null ? { followers } : {}) },
    })
    .returning();
  return row;
}

async function syncInteractions(acct: Account, provider: Provider, ref: AccountRef, save: CredentialUpdate) {
  const since = acct.lastSyncedAt ? new Date(acct.lastSyncedAt.getTime() - 3600_000) : new Date(Date.now() - 30 * DAY);
  const list = await provider.getInteractions(ref, save, since);
  let n = 0;
  for (const i of list) {
    const person = await upsertPerson(acct, i.person);
    const res = await db
      .insert(schema.interaction)
      .values({ personId: person.id, kind: i.kind, inbound: true, occurredAt: i.occurredAt, externalRef: i.externalRef })
      .onConflictDoNothing()
      .returning({ id: schema.interaction.id });
    n += res.length;
  }
  return n;
}

/** Re-sort everyone into circles from their latest numbers. Hand-placed people stay put. */
async function reclassify(acct: Account, myFollowers: number) {
  const people = await db.query.person.findMany({ where: and(eq(schema.person.accountId, acct.id), eq(schema.person.pinnedCircle, false)) });
  const ints = await interactionsByPerson(people.map((p) => p.id));
  for (const p of people) {
    const circle = classifyCircle(
      { followers: p.followers, baseline: p.baselineFollowers, baselineDays: daysAgo(p.baselineAt), interactions: ints.get(p.id) ?? [] },
      myFollowers,
    );
    if (circle !== p.circle) await db.update(schema.person).set({ circle }).where(eq(schema.person.id, p.id));
  }
  return people.length;
}

async function syncArchive(acct: Account, provider: Provider, ref: AccountRef, save: CredentialUpdate) {
  const ws = await db.query.workspace.findFirst({ where: eq(schema.workspace.userId, acct.userId) });
  const topics = ws?.topics ?? [];
  const posts = await provider.getOwnPosts(ref, save, 200);
  for (const p of posts.filter((x) => !x.isReply && x.text.trim())) {
    const values = {
      accountId: acct.id,
      externalId: p.externalId,
      replyRef: p.replyRef ?? null,
      url: p.url,
      text: p.text,
      topic: tagTopics(p.text, topics)[0] ?? null,
      postedAt: p.postedAt,
      likes: p.likes,
      replies: p.replies,
      reposts: p.reposts,
      saves: p.saves,
      impressions: p.impressions,
    };
    await db.insert(schema.post).values(values).onConflictDoUpdate({ target: [schema.post.accountId, schema.post.externalId], set: values });
  }
  return posts.length;
}

async function addAttribution(accountId: string, source: typeof schema.followAttribution.$inferInsert.source, count: number) {
  if (count <= 0) return;
  await db
    .insert(schema.followAttribution)
    .values({ accountId, day: today(), source, count })
    .onConflictDoUpdate({
      target: [schema.followAttribution.accountId, schema.followAttribution.day, schema.followAttribution.source],
      set: { count: sql`${schema.followAttribution.count} + ${count}` },
    });
}

async function attributionContext(acct: Account, provider: Provider, ref: AccountRef, save: CredentialUpdate): Promise<AttributionContext> {
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const replies = await db.query.reply.findMany({
    where: and(eq(schema.reply.accountId, acct.id), gte(schema.reply.createdAt, weekAgo), isNotNull(schema.reply.externalId)),
    columns: { id: true, externalId: true },
    limit: 30,
    orderBy: desc(schema.reply.createdAt),
  });
  const resurfaced = await db.query.post.findMany({
    where: and(eq(schema.post.accountId, acct.id), gte(schema.post.resurfacedAt, weekAgo), isNotNull(schema.post.resurfaceExternalId)),
    columns: { id: true, resurfaceExternalId: true },
    limit: 10,
  });
  const engagers = await provider.getEngagers(ref, save, [
    ...replies.map((r) => ({ externalId: r.externalId! })),
    ...resurfaced.map((p) => ({ externalId: p.resurfaceExternalId! })),
  ]);
  const replyEngagers = new Map<string, string>();
  for (const r of replies) engagers.get(r.externalId!)?.forEach((who) => replyEngagers.set(who, r.id));
  const resurfaceEngagers = new Map<string, string>();
  for (const p of resurfaced) engagers.get(p.resurfaceExternalId!)?.forEach((who) => resurfaceEngagers.set(who, p.id));

  const recent = await db
    .selectDistinct({ externalId: schema.person.externalId })
    .from(schema.person)
    .innerJoin(schema.interaction, eq(schema.interaction.personId, schema.person.id))
    .where(and(eq(schema.person.accountId, acct.id), gte(schema.interaction.occurredAt, new Date(Date.now() - 30 * DAY))));
  return { replyEngagers, resurfaceEngagers, recentPeople: new Set(recent.map((r) => r.externalId)) };
}

async function syncFollowers(acct: Account, provider: Provider, ref: AccountRef, save: CredentialUpdate, prevCount: number, nowCount: number, firstSync: boolean) {
  const listed = provider.capabilities.followerList ? await provider.getRecentFollowers(ref, save, 100) : null;

  if (!listed) {
    if (!firstSync) await addAttribution(acct.id, "unattributed", Math.max(0, nowCount - prevCount));
    return 0;
  }

  const known = await db.query.follower.findMany({
    where: and(eq(schema.follower.accountId, acct.id), inArray(schema.follower.externalId, listed.map((f) => f.externalId))),
    columns: { externalId: true },
  });
  const knownSet = new Set(known.map((k) => k.externalId));
  const fresh = listed.filter((f) => !knownSet.has(f.externalId));

  if (firstSync) {
    // Baseline: existing followers aren't new follows and must not be credited.
    if (fresh.length) await db.insert(schema.follower).values(fresh.map((f) => ({ accountId: acct.id, externalId: f.externalId, handle: f.handle }))).onConflictDoNothing();
    return 0;
  }

  const ctx = fresh.length ? await attributionContext(acct, provider, ref, save) : null;
  const counts: Record<string, number> = {};
  for (const f of fresh) {
    const a = attributeFollower(f.externalId, ctx!);
    counts[a.source] = (counts[a.source] ?? 0) + 1;
    await db.insert(schema.follower).values({ accountId: acct.id, externalId: f.externalId, handle: f.handle, source: a.source, sourceRef: a.ref }).onConflictDoNothing();
  }
  for (const [source, count] of Object.entries(counts)) await addAttribution(acct.id, source as "replies", count);
  await addAttribution(acct.id, "unattributed", followDelta(prevCount, nowCount, fresh.length).unattributed);
  return fresh.length;
}

/** Pull everything for one account. Safe to run concurrently with the UI; never posts anything. */
export async function syncAccount(accountId: string) {
  const acct = await db.query.socialAccount.findFirst({ where: eq(schema.socialAccount.id, accountId) });
  if (!acct || acct.status === "reauth" || !acct.credentials) return null;

  const provider = providerFor(acct.platform);
  const ref = toRef(acct);
  const save = credentialSaver(acct.id);
  const stats: Stats = {};
  const [run] = await db.insert(schema.syncRun).values({ accountId }).returning();
  const firstSync = !acct.lastSyncedAt;

  try {
    const profile = await syncProfile(acct, provider, ref, save);
    if (provider.capabilities.interactions) await step("interactions", stats, () => syncInteractions(acct, provider, ref, save));
    await step("circles", stats, () => reclassify(acct, profile.followers));
    if (provider.capabilities.rooms) await step("rooms", stats, () => syncRooms(acct, provider, ref, save, profile.followers));
    if (provider.capabilities.archive) await step("posts", stats, () => syncArchive(acct, provider, ref, save));
    await step("new_followers", stats, () => syncFollowers(acct, provider, ref, save, acct.followers, profile.followers, firstSync));

    await db.update(schema.socialAccount).set({ lastSyncedAt: new Date(), lastError: null, status: "active" }).where(eq(schema.socialAccount.id, acct.id));
    await db.update(schema.syncRun).set({ finishedAt: new Date(), ok: true, stats }).where(eq(schema.syncRun.id, run.id));
    log.info("sync.done", { accountId, platform: acct.platform, ...stats });
    return stats;
  } catch (err) {
    const reauth = err instanceof ReauthRequired;
    const message = reauth ? "Reconnect this account to keep syncing" : err instanceof RateLimited ? "The platform asked us to slow down. We'll retry shortly." : "Sync failed. We'll retry automatically.";
    await db
      .update(schema.socialAccount)
      .set({ lastError: message, ...(reauth ? { status: "reauth" as const } : {}), lastSyncedAt: new Date() })
      .where(eq(schema.socialAccount.id, acct.id));
    await db.update(schema.syncRun).set({ finishedAt: new Date(), ok: false, error: (err as Error).message.slice(0, 500), stats }).where(eq(schema.syncRun.id, run.id));
    log.error("sync.failed", { accountId, platform: acct.platform, error: err });
    return null;
  }
}

/**
 * Accounts whose plan interval has elapsed, oldest first. The cron route calls this
 * every few minutes and works through the list within its time budget.
 */
export async function dueAccounts(limit = 50) {
  const rows = await db.query.socialAccount.findMany({
    where: and(eq(schema.socialAccount.status, "active"), or(sql`${schema.socialAccount.lastSyncedAt} is null`, lt(schema.socialAccount.lastSyncedAt, new Date(Date.now() - 15 * 60_000)))),
    orderBy: asc(schema.socialAccount.lastSyncedAt),
    limit: limit * 2,
    columns: { id: true, userId: true, lastSyncedAt: true },
  });
  const planCache = new Map<string, number>();
  const due: string[] = [];
  for (const r of rows) {
    if (!planCache.has(r.userId)) planCache.set(r.userId, PLANS[await planFor(r.userId)].limits.syncMinutes);
    const every = planCache.get(r.userId)! * 60_000;
    if (!r.lastSyncedAt || Date.now() - r.lastSyncedAt.getTime() >= every) due.push(r.id);
    if (due.length >= limit) break;
  }
  return due;
}

/** Remove data we no longer need: finished sync runs after 30 days, expired OAuth state. */
export async function pruneOldData() {
  await db.delete(schema.syncRun).where(lt(schema.syncRun.startedAt, new Date(Date.now() - 30 * DAY)));
  await db.delete(schema.oauthStore).where(and(isNotNull(schema.oauthStore.expiresAt), lt(schema.oauthStore.expiresAt, new Date())));
  await db
    .delete(schema.room)
    .where(and(notInArray(schema.room.status, ["replied"]), lt(schema.room.postedAt, new Date(Date.now() - 14 * DAY))));
}
