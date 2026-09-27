import "server-only";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { AiUnavailable, OutOfCredits, assertCredits } from "./ai/client";
import { briefPerson, draftReply, draftReshare, learnVoice, triageRooms, writeBrief } from "./ai/tasks";
import { accountsFor, circles, ledger, localDay, openRooms, secondLife, storefront } from "./queries";
import { effectivePlan, PLANS, type Plan } from "./billing/plans";
import { db, schema } from "./db";
import { DEFAULT_AUTOPILOT } from "./db/schema";
import { sendEmail } from "./email";
import { env, features } from "./env";
import { credentialSaver, toRef } from "./accounts";
import { providerFor } from "./providers";
import { log } from "./log";
import { clip, pct } from "./format";
import type { Viewer } from "./session";

const DAY = 86_400_000;

/** One failed step (a timeout, an odd model reply) shouldn't cost the user the rest of their morning. */
async function step<T>(userId: string, name: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof OutOfCredits || err instanceof AiUnavailable) throw err;
    log.warn("autopilot.step_failed", { userId, step: name, error: err });
    return null;
  }
}

async function load(userId: string) {
  const [u, ws, sub] = await Promise.all([
    db.query.user.findFirst({ where: eq(schema.user.id, userId) }),
    db.query.workspace.findFirst({ where: eq(schema.workspace.userId, userId) }),
    db.query.subscription.findFirst({ where: eq(schema.subscription.userId, userId) }),
  ]);
  if (!u || !ws) return null;
  const plan: Plan = effectivePlan(sub ?? null);
  return { user: u, workspace: ws, plan, limits: PLANS[plan].limits };
}

export interface AutopilotReport {
  triaged: number;
  drafts: number;
  checkins: number;
  reshares: number;
  brief: boolean;
  skipped?: string;
}

/**
 * The daily autonomous pass. It reads, ranks and prepares; it never replies on the user's
 * behalf. Everything it writes lands in the Inbox for approval. The one exception is
 * resharing the user's own post, and only when they turned that on.
 */
export async function runAutopilot(userId: string, opts: { force?: boolean } = {}): Promise<AutopilotReport> {
  const report: AutopilotReport = { triaged: 0, drafts: 0, checkins: 0, reshares: 0, brief: false };
  if (!features.ai()) return { ...report, skipped: "ai_not_configured" };
  const ctx = await load(userId);
  if (!ctx) return { ...report, skipped: "no_user" };
  const settings = { ...DEFAULT_AUTOPILOT, ...ctx.workspace.autopilot };
  if (!ctx.limits.autopilot) return { ...report, skipped: "plan" };
  if (!settings.enabled && !opts.force) return { ...report, skipped: "off" };

  const tz = ctx.workspace.timezone;
  const today = localDay(tz);
  if (!opts.force && ctx.workspace.autopilotRanAt && localDay(tz, ctx.workspace.autopilotRanAt) === today) return { ...report, skipped: "already_ran" };

  // Claim today's run first so overlapping cron invocations don't double-spend credits.
  await db.update(schema.workspace).set({ autopilotRanAt: new Date() }).where(eq(schema.workspace.userId, userId));

  const accounts = await accountsFor(userId);
  if (!accounts.length) return { ...report, skipped: "no_accounts" };
  const topics = ctx.workspace.topics;

  try {
    await assertCredits(userId, ctx.plan, 3);
    let voice = ctx.workspace.voice ?? null;
    if (!voice || Date.now() - new Date(voice.learnedAt).getTime() > 14 * DAY) voice = (await step(userId, "voice", () => learnVoice(userId))) ?? voice;

    report.triaged = (await step(userId, "triage", () => triageRooms(userId, topics, voice))) ?? 0;

    const viewer = { user: ctx.user, workspace: ctx.workspace, plan: ctx.plan, limits: ctx.limits } as unknown as Viewer;
    const ids = accounts.map((a) => a.id);
    const rooms = await openRooms(viewer, ids);
    const drafted = new Set(
      (await db.query.draft.findMany({ where: and(eq(schema.draft.userId, userId), inArray(schema.draft.status, ["pending", "posted"])), columns: { roomId: true } })).map((d) => d.roomId),
    );
    const candidates = rooms.filter((r) => r.aiVerdict !== "skip" && !drafted.has(r.id) && r.windowLeft > 20).sort((a, b) => Number(b.aiVerdict === "strong") - Number(a.aiVerdict === "strong") || b.score - a.score);
    for (const r of candidates.slice(0, settings.draftsPerDay)) {
      await assertCredits(userId, ctx.plan);
      if (await step(userId, "draft", () => draftReply(userId, r.id, { topics, voice }))) report.drafts++;
    }

    const people = await circles(ids);
    for (const n of people.nudges.slice(0, 2)) {
      await assertCredits(userId, ctx.plan);
      if (await step(userId, "person", () => briefPerson(userId, n.personId, { voice, reason: n.reason }))) report.checkins++;
    }

    const archive = await secondLife(accounts, topics);
    const pick = archive.find((a) => a.score >= 55);
    if (pick) {
      await assertCredits(userId, ctx.plan);
      const d = await step(userId, "reshare", () => draftReshare(userId, pick.id, { voice, unseen: pick.unseen }));
      if (d) {
        report.reshares++;
        if (settings.autoReshare) await autoReshare(userId, d.id);
      }
    }

    const followers = accounts.reduce((n, a) => n + a.followers, 0);
    const led = await ledger(ids, 1);
    const week = led.weekly.at(-1);
    const fixes = storefront(accounts[0], topics).filter((c) => !c.ok);
    const facts = [
      `Name: ${ctx.user.name.split(" ")[0]}. Today: ${today}. Followers: ${followers} across ${accounts.length} account(s).`,
      week ? `This week so far: ${Object.entries(week).filter(([k]) => k !== "week").map(([k, v]) => `${k} ${v}`).join(", ")} new followers.` : "No follower history yet.",
      `Open rooms: ${rooms.length}, of which Autopilot rated ${rooms.filter((r) => r.aiVerdict === "strong").length} strong.`,
      ...candidates.slice(0, 3).map((r) => `Room: ${r.authorName} on "${clip(r.text, 120)}", window ${r.windowLeft} min, ${pct(1 - r.audienceOverlap)} new to them.${r.aiAngle ? ` Angle: ${r.aiAngle}` : ""}`),
      `Drafts prepared for approval: ${report.drafts} replies, ${report.checkins} check-ins, ${report.reshares} reshares.`,
      ...people.nudges.slice(0, 2).map((n) => `Person: ${n.person.name}: ${n.reason}.`),
      pick ? `Best old post to resurface: "${clip(pick.text, 100)}", ${pct(pick.unseen)} of followers never saw it.` : "",
      fixes[0] ? `Profile fix: ${fixes[0].label}.` : "",
    ].filter(Boolean);
    await assertCredits(userId, ctx.plan);
    const brief = await step(userId, "brief", () => writeBrief(userId, "morning", facts.join("\n"), today));
    report.brief = Boolean(brief);

    if (isMonday(tz)) await weeklyReview(userId, ctx.plan, ids, today).catch((err) => log.warn("autopilot.weekly_failed", { userId, error: err }));

    if (brief && settings.digest) {
      const inbox = report.drafts + report.checkins + report.reshares;
      await sendEmail({
        to: ctx.user.email,
        subject: brief.headline,
        text: `${brief.body}\n\n${inbox ? `${inbox} drafts are waiting for your approval:\n${env().APP_URL}/app/inbox` : `Open today's round: ${env().APP_URL}/app`}\n\nTurn this email off in Settings > Autopilot.`,
      }).catch((err) => log.warn("autopilot.digest_failed", { userId, error: err }));
    }
  } catch (err) {
    if (err instanceof OutOfCredits) report.skipped = "out_of_credits";
    else if (err instanceof AiUnavailable) report.skipped = "ai_not_configured";
    else {
      log.error("autopilot.failed", { userId, error: err });
      report.skipped = "error";
    }
  }
  log.info("autopilot.done", { userId, ...report });
  return report;
}

function isMonday(tz: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).format(new Date()) === "Mon";
}

async function weeklyReview(userId: string, plan: Plan, ids: string[], today: string) {
  await assertCredits(userId, plan);
  const led = await ledger(ids, 5);
  const replies = await db.query.reply.findMany({
    where: and(eq(schema.reply.userId, userId), sql`${schema.reply.createdAt} > now() - interval '7 days'`),
    columns: { text: true, grade: true, score: true, postedVia: true },
  });
  const facts = [
    "Weekly new followers by source, oldest first:",
    ...led.weekly.map((w) => `${w.week}: replies ${w.replies}, relationships ${w.relationships}, resurfaced ${w.resurfaced}, profile ${w.profile}, unattributed ${w.unattributed}`),
    `Replies last 7 days: ${replies.length}. Grades: ${["Magnetic", "Useful", "Polite", "Invisible"].map((g) => `${g} ${replies.filter((r) => r.grade === g).length}`).join(", ")}.`,
    ...replies
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => `Top reply (${r.grade}): "${clip(r.text, 140)}"`),
  ];
  return writeBrief(userId, "weekly", facts.join("\n"), today);
}

async function autoReshare(userId: string, draftId: string) {
  const d = await db.query.draft.findFirst({ where: eq(schema.draft.id, draftId) });
  if (!d?.postId) return;
  const rows = await db
    .select({ post: schema.post, account: schema.socialAccount })
    .from(schema.post)
    .innerJoin(schema.socialAccount, eq(schema.socialAccount.id, schema.post.accountId))
    .where(and(eq(schema.post.id, d.postId), eq(schema.socialAccount.userId, userId)))
    .limit(1);
  const r = rows[0];
  if (!r) return;
  const provider = providerFor(r.account.platform);
  if (!provider.capabilities.post) return;
  try {
    const posted = await provider.quote(toRef(r.account), credentialSaver(r.account.id), { externalId: r.post.externalId, url: r.post.url, replyRef: r.post.replyRef }, d.text);
    await db.update(schema.post).set({ resurfacedAt: new Date(), resurfaceExternalId: posted.externalId }).where(eq(schema.post.id, r.post.id));
    await db.update(schema.draft).set({ status: "posted", decidedAt: new Date(), resultUrl: posted.url, source: "autopilot-auto" }).where(eq(schema.draft.id, d.id));
    await db.insert(schema.auditEvent).values({ userId, action: "autopilot.auto_reshare", detail: { postId: r.post.id, url: posted.url } });
  } catch (err) {
    log.warn("autopilot.auto_reshare_failed", { userId, error: err });
  }
}

/** Users whose Autopilot hasn't run in the last 20 hours. Their local day decides the rest. */
export async function dueAutopilotUsers(limit = 25) {
  const rows = await db
    .select({ userId: schema.workspace.userId })
    .from(schema.workspace)
    .innerJoin(schema.subscription, eq(schema.subscription.userId, schema.workspace.userId))
    .where(
      and(
        inArray(schema.subscription.plan, ["grower", "studio"]),
        or(isNull(schema.workspace.autopilotRanAt), lt(schema.workspace.autopilotRanAt, new Date(Date.now() - 20 * 3600_000))),
      ),
    )
    .limit(limit);
  return rows.map((r) => r.userId);
}

/** Cheap pass after every sync: triage whatever rooms just arrived so skips never reach the user. */
export async function triageAfterSync(userId: string) {
  if (!features.ai()) return;
  const ctx = await load(userId);
  if (!ctx?.limits.autopilot) return;
  try {
    await assertCredits(userId, ctx.plan);
    await triageRooms(userId, ctx.workspace.topics, ctx.workspace.voice ?? null);
  } catch (err) {
    if (!(err instanceof OutOfCredits)) log.warn("autopilot.triage_failed", { userId, error: err });
  }
}
