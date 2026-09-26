import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "./db";
import {
  auditProfile,
  engagementPoints,
  nudges,
  percentile,
  reciprocity,
  resurfaceScore,
  unseenShare,
  warmth,
  daysSinceContact,
  type InteractionLite,
  type TopicDef,
} from "./scoring";
import type { Viewer } from "./session";

const DAY = 86_400_000;
const daysAgo = (d: Date) => Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY));

/** Today's date in the user's timezone, as YYYY-MM-DD. */
export function localDay(timezone: string, at = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export async function accountsFor(userId: string) {
  return db.query.socialAccount.findMany({ where: eq(schema.socialAccount.userId, userId), orderBy: asc(schema.socialAccount.createdAt) });
}

export type AccountRow = Awaited<ReturnType<typeof accountsFor>>[number];

export async function openRooms(viewer: Viewer, accountIds: string[], limit?: number) {
  if (accountIds.length === 0) return [];
  const rows = await db.query.room.findMany({
    where: and(inArray(schema.room.accountId, accountIds), eq(schema.room.status, "open")),
    orderBy: desc(schema.room.score),
    limit: Math.min(limit ?? 100, viewer.limits.roomsPerDay),
  });
  // Window shrinks between syncs; recompute from the stored velocity.
  return rows
    .map((r) => {
      const ageMin = (Date.now() - r.postedAt.getTime()) / 60_000;
      const sinceFetch = (Date.now() - r.fetchedAt.getTime()) / 60_000;
      const windowLeft = Math.max(0, Math.round((r.breakdown?.windowMinutes ?? 0) - sinceFetch));
      return { ...r, ageMinutes: Math.round(ageMin), windowLeft };
    })
    .filter((r) => r.windowLeft > 0 || r.manual);
}

export type RoomRow = Awaited<ReturnType<typeof openRooms>>[number];

async function interactionMap(personIds: string[]) {
  const map = new Map<string, (InteractionLite & { occurredAt: Date; note: string | null })[]>();
  if (personIds.length === 0) return map;
  const rows = await db.query.interaction.findMany({
    where: and(inArray(schema.interaction.personId, personIds), gte(schema.interaction.occurredAt, new Date(Date.now() - 180 * DAY))),
    orderBy: desc(schema.interaction.occurredAt),
  });
  for (const r of rows) {
    const list = map.get(r.personId) ?? [];
    list.push({ kind: r.kind, inbound: r.inbound, daysAgo: daysAgo(r.occurredAt), occurredAt: r.occurredAt, note: r.note });
    map.set(r.personId, list);
  }
  return map;
}

export async function circles(accountIds: string[]) {
  if (accountIds.length === 0) return { people: [], nudges: [] };
  const people = await db.query.person.findMany({ where: inArray(schema.person.accountId, accountIds) });
  const ints = await interactionMap(people.map((p) => p.id));
  const enriched = people
    .map((p) => {
      const list = ints.get(p.id) ?? [];
      return {
        ...p,
        interactions: list,
        warmth: warmth(list),
        balance: reciprocity(list),
        lastContactDays: daysSinceContact(list),
        growth: p.baselineFollowers > 0 ? p.followers / p.baselineFollowers - 1 : 0,
      };
    })
    .filter((p) => p.interactions.length > 0 || p.pinnedCircle || p.note)
    .sort((a, b) => b.warmth - a.warmth);
  const n = nudges(
    enriched.map((p) => ({
      id: p.id,
      name: p.name,
      circle: p.circle,
      followers: p.followers,
      baseline: p.baselineFollowers,
      interactions: p.interactions,
      lastGreetedDaysAgo: p.lastGreetedAt ? daysAgo(p.lastGreetedAt) : null,
    })),
  );
  return { people: enriched, nudges: n.map((x) => ({ ...x, person: enriched.find((p) => p.id === x.personId)! })) };
}

export type CirclePerson = Awaited<ReturnType<typeof circles>>["people"][number];

export async function secondLife(accounts: AccountRow[], topics: TopicDef[]) {
  if (accounts.length === 0) return [];
  const ids = accounts.map((a) => a.id);
  const [posts, snaps] = await Promise.all([
    db.query.post.findMany({ where: inArray(schema.post.accountId, ids), orderBy: desc(schema.post.postedAt), limit: 400 }),
    db.query.followerSnapshot.findMany({ where: inArray(schema.followerSnapshot.accountId, ids) }),
  ]);
  const weights = Object.fromEntries(topics.map((t) => [t.name, t.weight]));
  const byAccount = new Map(accounts.map((a) => [a.id, a]));
  const p75 = new Map<string, number>();
  for (const a of accounts) p75.set(a.id, percentile(posts.filter((p) => p.accountId === a.id).map(engagementPoints), 0.75));

  return posts
    .map((p) => {
      const acct = byAccount.get(p.accountId)!;
      const history = snaps.filter((s) => s.accountId === p.accountId).map((s) => ({ day: s.day, followers: s.followers }));
      const unseen = unseenShare(p.postedAt, history, acct.followers);
      const points = engagementPoints(p);
      const score = resurfaceScore({
        unseen,
        points,
        p75: p75.get(p.accountId) ?? 1,
        topicWeight: p.topic ? (weights[p.topic] ?? 0.3) : 0.3,
        dated: p.dated,
        resurfacedDaysAgo: p.resurfacedAt ? daysAgo(p.resurfacedAt) : null,
        ageDays: daysAgo(p.postedAt),
      });
      return { ...p, platform: acct.platform, unseen, points, score, historyDays: history.length };
    })
    .sort((a, b) => b.score - a.score);
}

export type ArchiveRow = Awaited<ReturnType<typeof secondLife>>[number];

export async function ledger(accountIds: string[], weeks = 12) {
  if (accountIds.length === 0) return { weekly: [], snapshots: [] };
  const since = new Date(Date.now() - weeks * 7 * DAY).toISOString().slice(0, 10);
  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${schema.followAttribution.day}::timestamp), 'YYYY-MM-DD')`,
      source: schema.followAttribution.source,
      count: sql<number>`sum(${schema.followAttribution.count})::int`,
    })
    .from(schema.followAttribution)
    .where(and(inArray(schema.followAttribution.accountId, accountIds), gte(schema.followAttribution.day, since)))
    .groupBy(sql`1`, schema.followAttribution.source)
    .orderBy(sql`1`);
  const snapshots = await db
    .select({ day: schema.followerSnapshot.day, followers: sql<number>`sum(${schema.followerSnapshot.followers})::int` })
    .from(schema.followerSnapshot)
    .where(and(inArray(schema.followerSnapshot.accountId, accountIds), gte(schema.followerSnapshot.day, since)))
    .groupBy(schema.followerSnapshot.day)
    .orderBy(schema.followerSnapshot.day);

  const weekly = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const w = weekly.get(r.week) ?? { replies: 0, relationships: 0, resurfaced: 0, profile: 0, unattributed: 0 };
    w[r.source] = r.count;
    weekly.set(r.week, w);
  }
  return { weekly: [...weekly.entries()].map(([week, v]) => ({ week, ...v })) as ({ week: string } & Record<"replies" | "relationships" | "resurfaced" | "profile" | "unattributed", number>)[], snapshots };
}

export async function replyStats(userId: string, sinceDays = 84) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int`, avg: sql<number>`coalesce(avg(${schema.reply.score}), 0)::int` })
    .from(schema.reply)
    .where(and(eq(schema.reply.userId, userId), gte(schema.reply.createdAt, new Date(Date.now() - sinceDays * DAY))));
  return row;
}

export function storefront(account: AccountRow, topics: TopicDef[]) {
  return auditProfile({ bio: account.bio, pinned: account.pinnedPost ?? null, topics });
}

export async function completions(userId: string, day: string) {
  const rows = await db.query.roundCompletion.findMany({ where: and(eq(schema.roundCompletion.userId, userId), eq(schema.roundCompletion.day, day)) });
  return new Set(rows.map((r) => r.itemKey));
}

export async function pendingReauth(userId: string) {
  return db.query.socialAccount.findMany({ where: and(eq(schema.socialAccount.userId, userId), eq(schema.socialAccount.status, "reauth")) });
}

export async function neverSynced(userId: string) {
  return db.query.socialAccount.findMany({ where: and(eq(schema.socialAccount.userId, userId), isNull(schema.socialAccount.lastSyncedAt)) });
}
