"use server";

import { and, count, eq, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { credentialSaver, ownedAccount, toRef } from "@/lib/accounts";
import { auth, polarSdk } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { providerFor } from "@/lib/providers";
import { blueskyClient } from "@/lib/providers/bluesky-oauth";
import { NotAvailable, ReauthRequired } from "@/lib/providers/types";
import { localDay } from "@/lib/queries";
import { checkReply, leverage, tagTopics, topicWeights } from "@/lib/scoring";
import { requireUser } from "@/lib/session";
import { syncAccount } from "@/lib/sync";

export type ActionResult = { ok: true; message?: string; url?: string } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

function refresh() {
  revalidatePath("/app", "layout");
}

async function audit(userId: string, action: string, detail?: Record<string, unknown>) {
  await db.insert(schema.auditEvent).values({ userId, action, detail });
}

/* ------------------------------ topics ------------------------------ */

const topicsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(2).max(40),
      weight: z.number().min(0.1).max(1),
      keywords: z.array(z.string().trim().min(2).max(40)).max(8),
    }),
  )
  .min(1, "Add at least one topic")
  .max(8, "Keep it to eight topics or fewer");

export async function saveTopics(input: unknown): Promise<ActionResult> {
  const viewer = await requireUser();
  const parsed = topicsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your topics");
  await db
    .update(schema.workspace)
    .set({ topics: parsed.data })
    .where(eq(schema.workspace.userId, viewer.user.id));
  refresh();
  return { ok: true, message: "Topics saved" };
}

export async function setTimezone(timezone: string) {
  const viewer = await requireUser();
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return;
  }
  if (viewer.workspace.timezone !== timezone) await db.update(schema.workspace).set({ timezone }).where(eq(schema.workspace.userId, viewer.user.id));
}

export async function finishOnboarding() {
  const viewer = await requireUser();
  await db.update(schema.workspace).set({ onboardedAt: new Date() }).where(eq(schema.workspace.userId, viewer.user.id));
  redirect("/app");
}

/* ------------------------------ round ------------------------------- */

export async function toggleRoundItem(itemKey: string, done: boolean): Promise<ActionResult> {
  const viewer = await requireUser();
  if (!/^[a-z]+:[\w:-]{1,80}$/.test(itemKey)) return fail("Unknown item");
  const day = localDay(viewer.workspace.timezone);
  if (done) await db.insert(schema.roundCompletion).values({ userId: viewer.user.id, day, itemKey }).onConflictDoNothing();
  else
    await db
      .delete(schema.roundCompletion)
      .where(and(eq(schema.roundCompletion.userId, viewer.user.id), eq(schema.roundCompletion.day, day), eq(schema.roundCompletion.itemKey, itemKey)));
  refresh();
  return { ok: true };
}

/* ------------------------------ rooms ------------------------------- */

async function ownedRoom(userId: string, roomId: string) {
  const r = await db
    .select({ room: schema.room, account: schema.socialAccount })
    .from(schema.room)
    .innerJoin(schema.socialAccount, eq(schema.socialAccount.id, schema.room.accountId))
    .where(and(eq(schema.room.id, roomId), eq(schema.socialAccount.userId, userId)))
    .limit(1);
  return r[0];
}

export async function dismissRoom(roomId: string): Promise<ActionResult> {
  const viewer = await requireUser();
  const r = await ownedRoom(viewer.user.id, roomId);
  if (!r) return fail("Room not found");
  await db.update(schema.room).set({ status: "dismissed" }).where(eq(schema.room.id, roomId));
  refresh();
  return { ok: true, message: "Room hidden" };
}

const manualRoomSchema = z.object({
  accountId: z.string().min(1),
  url: z.url().max(500),
  author: z.string().trim().min(1).max(80),
  text: z.string().trim().min(10, "Paste the post's text so Tendril can check your reply against it").max(3000),
});

/** Add a conversation by link. The only way to use Rooms on LinkedIn, and handy anywhere. */
export async function addManualRoom(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const viewer = await requireUser();
  const parsed = manualRoomSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form");
  const acct = await ownedAccount(viewer.user.id, parsed.data.accountId);
  if (!acct) return fail("Choose one of your accounts");
  const host = new URL(parsed.data.url).hostname.replace(/^www\./, "");
  const allowed = { bluesky: ["bsky.app"], x: ["x.com", "twitter.com"], threads: ["threads.net", "threads.com"], linkedin: ["linkedin.com"] }[acct.platform];
  if (!allowed.some((h) => host === h || host.endsWith(`.${h}`))) return fail(`That link isn't a ${acct.platform} post`);

  const topics = viewer.workspace.topics;
  const tagged = tagTopics(parsed.data.text, topics);
  const lev = leverage(
    { topics: tagged, ageMinutes: 30, replies: 0, velocity: 0, audienceOverlap: 0.1, authorFollowers: null, knownWarmth: null },
    { weights: topicWeights(topics), myFollowers: acct.followers },
  );
  const [row] = await db
    .insert(schema.room)
    .values({
      accountId: acct.id,
      externalId: `manual:${parsed.data.url}`,
      url: parsed.data.url,
      authorExternalId: `manual:${parsed.data.author}`,
      authorHandle: parsed.data.author,
      authorName: parsed.data.author,
      text: parsed.data.text,
      topics: tagged,
      postedAt: new Date(),
      score: lev.score,
      breakdown: { fit: lev.fit, early: lev.early, reach: lev.reach, rapport: lev.rapport, windowMinutes: 240 },
      manual: true,
    })
    .onConflictDoUpdate({ target: [schema.room.accountId, schema.room.externalId], set: { text: parsed.data.text, status: "open" } })
    .returning({ id: schema.room.id });
  refresh();
  redirect(`/app/rooms/${row.id}`);
}

const replySchema = z.object({ roomId: z.string().min(1), text: z.string().trim().min(1).max(3000), mode: z.enum(["post", "log"]) });

/**
 * Post the user's own words as a reply, or log a reply they posted themselves.
 * Tendril never writes or schedules replies.
 */
export async function sendReply(input: z.infer<typeof replySchema>): Promise<ActionResult> {
  const viewer = await requireUser();
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return fail("Write a reply first");
  const r = await ownedRoom(viewer.user.id, parsed.data.roomId);
  if (!r) return fail("Room not found");
  const provider = providerFor(r.account.platform);
  const check = checkReply(parsed.data.text);

  let posted: { externalId: string; url: string } | null = null;
  if (parsed.data.mode === "post") {
    if (!viewer.limits.postFromTendril) return fail("Posting from Tendril is part of Grower. Copy the reply and mark it as replied instead.");
    if (!provider.capabilities.post || r.room.manual) return fail("This platform doesn't allow posting replies from other apps. Copy it instead.");
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.reply)
      .where(and(eq(schema.reply.userId, viewer.user.id), eq(schema.reply.postedVia, "tendril"), gte(schema.reply.createdAt, new Date(Date.now() - 3600_000))));
    if (n >= 20) return fail("That's 20 replies in the last hour. Take a breather; platforms flag bursts.");
    try {
      posted = await provider.reply(toRef(r.account), credentialSaver(r.account.id), { externalId: r.room.externalId, replyRef: r.room.replyRef }, parsed.data.text);
    } catch (err) {
      if (err instanceof ReauthRequired) {
        await db.update(schema.socialAccount).set({ status: "reauth", lastError: err.message }).where(eq(schema.socialAccount.id, r.account.id));
        return fail("Reconnect this account in Settings, then try again.");
      }
      if (err instanceof NotAvailable) return fail(err.message);
      log.error("reply.post_failed", { roomId: r.room.id, error: err });
      return fail("The platform rejected the reply. Your text is still here.");
    }
  }

  await db.insert(schema.reply).values({
    userId: viewer.user.id,
    accountId: r.account.id,
    roomId: r.room.id,
    text: parsed.data.text,
    grade: check.grade,
    score: check.score,
    externalId: posted?.externalId ?? null,
    url: posted?.url ?? null,
    postedVia: posted ? "tendril" : "manual",
  });
  await db.update(schema.room).set({ status: "replied" }).where(eq(schema.room.id, r.room.id));

  // Replying to someone counts toward your relationship with them.
  if (!r.room.manual) {
    const [person] = await db
      .insert(schema.person)
      .values({
        accountId: r.account.id,
        externalId: r.room.authorExternalId,
        handle: r.room.authorHandle,
        name: r.room.authorName,
        followers: r.room.authorFollowers ?? 0,
        baselineFollowers: r.room.authorFollowers ?? 0,
        circle: "peer",
      })
      .onConflictDoUpdate({ target: [schema.person.accountId, schema.person.externalId], set: { handle: r.room.authorHandle } })
      .returning({ id: schema.person.id });
    await db
      .insert(schema.interaction)
      .values({ personId: person.id, kind: "my-reply", inbound: false, occurredAt: new Date(), externalRef: posted?.externalId ?? `room:${r.room.id}` })
      .onConflictDoNothing();
  }
  await db
    .insert(schema.roundCompletion)
    .values({ userId: viewer.user.id, day: localDay(viewer.workspace.timezone), itemKey: `room:${r.room.id}` })
    .onConflictDoNothing();
  refresh();
  return { ok: true, message: posted ? "Reply posted" : "Logged as replied", url: posted?.url };
}

/* ----------------------------- circles ------------------------------ */

async function ownedPerson(userId: string, personId: string) {
  const r = await db
    .select({ person: schema.person })
    .from(schema.person)
    .innerJoin(schema.socialAccount, eq(schema.socialAccount.id, schema.person.accountId))
    .where(and(eq(schema.person.id, personId), eq(schema.socialAccount.userId, userId)))
    .limit(1);
  return r[0]?.person;
}

export async function markGreeted(personId: string): Promise<ActionResult> {
  const viewer = await requireUser();
  const p = await ownedPerson(viewer.user.id, personId);
  if (!p) return fail("Person not found");
  await db.update(schema.person).set({ lastGreetedAt: new Date() }).where(eq(schema.person.id, p.id));
  await db
    .insert(schema.interaction)
    .values({ personId: p.id, kind: "dm", inbound: false, occurredAt: new Date(), externalRef: `greet:${Date.now()}`, note: "Logged a hello" });
  await db
    .insert(schema.roundCompletion)
    .values({ userId: viewer.user.id, day: localDay(viewer.workspace.timezone), itemKey: `person:${p.id}` })
    .onConflictDoNothing();
  refresh();
  return { ok: true, message: `Logged your hello to ${p.name}` };
}

const personEdit = z.object({
  personId: z.string().min(1),
  circle: z.enum(["anchor", "peer", "rising", "fan", "auto"]),
  note: z.string().max(500),
});

export async function editPerson(input: z.infer<typeof personEdit>): Promise<ActionResult> {
  const viewer = await requireUser();
  const parsed = personEdit.safeParse(input);
  if (!parsed.success) return fail("Check the form");
  const p = await ownedPerson(viewer.user.id, parsed.data.personId);
  if (!p) return fail("Person not found");
  await db
    .update(schema.person)
    .set({ note: parsed.data.note || null, ...(parsed.data.circle === "auto" ? { pinnedCircle: false } : { circle: parsed.data.circle, pinnedCircle: true }) })
    .where(eq(schema.person.id, p.id));
  refresh();
  return { ok: true, message: "Saved" };
}

/* --------------------------- second life ---------------------------- */

async function ownedPost(userId: string, postId: string) {
  const r = await db
    .select({ post: schema.post, account: schema.socialAccount })
    .from(schema.post)
    .innerJoin(schema.socialAccount, eq(schema.socialAccount.id, schema.post.accountId))
    .where(and(eq(schema.post.id, postId), eq(schema.socialAccount.userId, userId)))
    .limit(1);
  return r[0];
}

export async function setDated(postId: string, dated: boolean): Promise<ActionResult> {
  const viewer = await requireUser();
  const r = await ownedPost(viewer.user.id, postId);
  if (!r) return fail("Post not found");
  await db.update(schema.post).set({ dated }).where(eq(schema.post.id, postId));
  refresh();
  return { ok: true, message: dated ? "Retired" : "Back in the vault" };
}

export async function resurface(input: { postId: string; text: string; mode: "post" | "log" }): Promise<ActionResult> {
  const viewer = await requireUser();
  if (!viewer.limits.secondLife) return fail("Second Life is part of Grower");
  const text = z.string().trim().min(1).max(3000).safeParse(input.text);
  if (!text.success) return fail("Write a new first line first");
  const r = await ownedPost(viewer.user.id, input.postId);
  if (!r) return fail("Post not found");
  let posted: { externalId: string; url: string } | null = null;
  if (input.mode === "post") {
    const provider = providerFor(r.account.platform);
    if (!provider.capabilities.post) return fail("This platform doesn't allow posting from other apps");
    try {
      posted = await provider.quote(toRef(r.account), credentialSaver(r.account.id), { externalId: r.post.externalId, url: r.post.url, replyRef: r.post.replyRef }, text.data);
    } catch (err) {
      if (err instanceof ReauthRequired) return fail("Reconnect this account in Settings, then try again.");
      log.error("resurface.failed", { postId: r.post.id, error: err });
      return fail("The platform rejected the post. Your text is still here.");
    }
  }
  await db.update(schema.post).set({ resurfacedAt: new Date(), resurfaceExternalId: posted?.externalId ?? null }).where(eq(schema.post.id, r.post.id));
  await db
    .insert(schema.roundCompletion)
    .values({ userId: viewer.user.id, day: localDay(viewer.workspace.timezone), itemKey: `post:${r.post.id}` })
    .onConflictDoNothing();
  refresh();
  return { ok: true, message: posted ? "Posted" : "Logged as resurfaced", url: posted?.url };
}

/* ----------------------------- accounts ----------------------------- */

export async function syncNow(accountId: string): Promise<ActionResult> {
  const viewer = await requireUser();
  const acct = await ownedAccount(viewer.user.id, accountId);
  if (!acct) return fail("Account not found");
  if (acct.status === "reauth") return fail("Reconnect this account first");
  if (acct.lastSyncedAt && Date.now() - acct.lastSyncedAt.getTime() < 2 * 60_000) return fail("Synced less than two minutes ago");
  after(() => syncAccount(acct.id).then(() => undefined));
  return { ok: true, message: "Sync started. Refresh in a minute." };
}

export async function disconnectAccount(accountId: string): Promise<ActionResult> {
  const viewer = await requireUser();
  const acct = await ownedAccount(viewer.user.id, accountId);
  if (!acct) return fail("Account not found");
  if (acct.platform === "bluesky") {
    try {
      await (await blueskyClient()).revoke(acct.externalId);
    } catch (err) {
      log.warn("disconnect.bluesky_revoke_failed", { error: err });
    }
  }
  // Cascades to rooms, people, posts, snapshots and attribution for this account.
  await db.delete(schema.socialAccount).where(eq(schema.socialAccount.id, acct.id));
  await audit(viewer.user.id, "account.disconnected", { platform: acct.platform, handle: acct.handle });
  refresh();
  return { ok: true, message: `Disconnected ${acct.handle}. Its data is deleted.` };
}

/* ------------------------------ profile ----------------------------- */

export async function updateName(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireUser();
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) return fail("Enter your name");
  await auth().api.updateUser({ body: { name: name.data }, headers: await headers() });
  refresh();
  return { ok: true, message: "Saved" };
}

/**
 * Permanently delete the user and everything Tendril stored. Active Polar
 * subscriptions are revoked first so nobody is billed for a deleted account.
 */
export async function deleteAccount(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const viewer = await requireUser();
  if (form.get("confirm") !== viewer.user.email) return fail("Type your email address exactly to confirm");
  if (Date.now() - new Date(viewer.session.createdAt).getTime() > 24 * 3600_000) {
    return fail("For your security, sign out and sign in again, then delete your account.");
  }
  const polar = polarSdk();
  if (polar && viewer.subscription?.polarSubscriptionId && viewer.plan !== "free") {
    try {
      await polar.subscriptions.revoke({ id: viewer.subscription.polarSubscriptionId });
    } catch (err) {
      log.error("account.delete_revoke_failed", { userId: viewer.user.id, error: err });
      return fail("We couldn't cancel your subscription. Cancel it in Billing first, then try again.");
    }
  }
  const accts = await db.query.socialAccount.findMany({ where: eq(schema.socialAccount.userId, viewer.user.id) });
  const bsky = accts.filter((a) => a.platform === "bluesky");
  for (const a of bsky) await (await blueskyClient()).revoke(a.externalId).catch(() => {});
  if (accts.length) await db.delete(schema.socialAccount).where(inArray(schema.socialAccount.id, accts.map((a) => a.id)));
  await db.delete(schema.user).where(eq(schema.user.id, viewer.user.id));
  log.info("account.deleted", { userId: viewer.user.id });
  redirect("/?deleted=1");
}
