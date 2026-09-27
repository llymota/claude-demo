import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import type { Brief, VoiceProfile } from "../db/schema";
import { log } from "../log";
import { gradeReply } from "../jev";
import type { TopicDef } from "../scoring";
import { anthropic, FALLBACK, model, recordUsage, UNTRUSTED_RULE, untrusted } from "./client";

type Effort = "low" | "medium" | "high";

/** One structured call. Returns null when the model declines. */
async function structured<S extends z.ZodType>(opts: { userId: string; credits: number; schema: S; system: string; prompt: string; effort?: Effort }): Promise<z.infer<S> | null> {
  let res;
  try {
    res = await anthropic().beta.messages.parse({
    model: model(),
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    });
  } catch (err) {
    // A reply that doesn't match the schema is a skipped step, not a failed run.
    if (err instanceof Anthropic.AnthropicError && !(err instanceof Anthropic.APIError)) {
      log.warn("ai.structured_parse_failed", { userId: opts.userId, error: err });
      return null;
    }
    throw err;
  }
  await recordUsage(opts.userId, opts.credits, res.usage);
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") {
    log.warn("ai.structured_incomplete", { userId: opts.userId, stop: res.stop_reason });
    return null;
  }
  return (res.parsed_output as z.infer<S> | null) ?? null;
}

const topicLine = (topics: TopicDef[]) => topics.map((t) => `${t.name} (${t.weight >= 0.8 ? "deep expertise" : t.weight >= 0.5 ? "some experience" : "light"})`).join(", ");

function voiceBlock(voice: VoiceProfile | null) {
  if (!voice) return "No voice profile yet. Write plainly, first person, short sentences.";
  return [
    `How they write: ${voice.summary}`,
    `Traits: ${voice.traits.join("; ")}`,
    `They never: ${voice.avoid.join("; ")}`,
    "Examples of their own writing:",
    ...voice.samples.map((s) => untrusted("sample", s)),
  ].join("\n");
}

async function userAccountIds(userId: string) {
  const rows = await db.query.socialAccount.findMany({ where: eq(schema.socialAccount.userId, userId), columns: { id: true } });
  return rows.map((r) => r.id);
}

/* ------------------------------------------------------------------ */
/* Voice                                                               */
/* ------------------------------------------------------------------ */

const VoiceSchema = z.object({
  summary: z.string().describe("Two sentences on how this person writes: rhythm, register, stance."),
  traits: z.array(z.string()).describe("4 to 6 concrete habits, e.g. 'opens with a number', 'uses lowercase', 'dry humour'."),
  avoid: z.array(z.string()).describe("3 to 5 things they never do in writing."),
  samples: z.array(z.string()).describe("3 of their posts copied verbatim that best show their voice."),
});

/** Learns how the user writes from their own posts and replies. Needs at least five samples. */
export async function learnVoice(userId: string): Promise<VoiceProfile | null> {
  const ids = await userAccountIds(userId);
  if (!ids.length) return null;
  const [posts, replies] = await Promise.all([
    db.query.post.findMany({ where: inArray(schema.post.accountId, ids), orderBy: desc(schema.post.postedAt), limit: 40, columns: { text: true } }),
    db.query.reply.findMany({ where: eq(schema.reply.userId, userId), orderBy: desc(schema.reply.createdAt), limit: 20, columns: { text: true } }),
  ]);
  const texts = [...posts, ...replies].map((p) => p.text.trim()).filter((t) => t.length > 20);
  if (texts.length < 5) return null;

  const out = await structured({
    userId,
    credits: 1,
    schema: VoiceSchema,
    effort: "medium",
    system: `You study a person's writing so drafts can sound like them. ${UNTRUSTED_RULE}`,
    prompt: `Here are posts and replies this person wrote.\n\n${texts.map((t) => untrusted("post", t)).join("\n")}\n\nDescribe their voice.`,
  });
  if (!out) return null;
  const voice: VoiceProfile = { ...out, samples: out.samples.slice(0, 3), learnedFrom: texts.length, learnedAt: new Date().toISOString() };
  await db.update(schema.workspace).set({ voice }).where(eq(schema.workspace.userId, userId));
  return voice;
}

/* ------------------------------------------------------------------ */
/* Room triage                                                         */
/* ------------------------------------------------------------------ */

const TriageSchema = z.object({
  rooms: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(["strong", "maybe", "skip"]),
      reason: z.string().describe("One short sentence the user will read."),
      angle: z.string().describe("The specific point, story or number this user could add, based on their topics and posts. Empty if verdict is skip."),
    }),
  ),
});

/**
 * Reads new rooms the way the user would: is this a real conversation they can add to,
 * or bait, hostility, or off-topic keyword noise? Keyword matching can't tell.
 */
export async function triageRooms(userId: string, topics: TopicDef[], voice: VoiceProfile | null, limit = 25) {
  const ids = await userAccountIds(userId);
  if (!ids.length) return 0;
  const rooms = await db.query.room.findMany({
    where: and(inArray(schema.room.accountId, ids), eq(schema.room.status, "open"), isNull(schema.room.aiVerdict)),
    orderBy: desc(schema.room.score),
    limit,
  });
  if (!rooms.length) return 0;

  const out = await structured({
    userId,
    credits: 1,
    schema: TriageSchema,
    effort: "low",
    system: [
      "You triage social media conversations for someone who grows by replying thoughtfully to others.",
      "strong: a genuine question or discussion where their expertise adds something specific.",
      "maybe: on topic but crowded, vague, or needing a stretch.",
      "skip: engagement bait, rage, giveaways, promotions, bots, or a keyword match on an unrelated subject.",
      UNTRUSTED_RULE,
    ].join("\n"),
    prompt: [
      `Their topics: ${topicLine(topics)}`,
      voice ? `What they tend to talk about: ${voice.summary}` : "",
      "",
      ...rooms.map((r) => untrusted("post", `id: ${r.id}\nauthor: ${r.authorName} (@${r.authorHandle})\nreplies so far: ${r.replyCount}\n\n${r.text}`)),
    ].join("\n"),
  });
  if (!out) return 0;
  const known = new Set(rooms.map((r) => r.id));
  let n = 0;
  for (const v of out.rooms) {
    if (!known.has(v.id)) continue;
    await db
      .update(schema.room)
      .set({ aiVerdict: v.verdict, aiReason: v.reason.slice(0, 300), aiAngle: v.verdict === "skip" ? null : v.angle.slice(0, 500) || null, ...(v.verdict === "skip" ? { status: "dismissed" as const } : {}) })
      .where(eq(schema.room.id, v.id));
    n++;
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* Drafts                                                              */
/* ------------------------------------------------------------------ */

const DraftSchema = z.object({
  text: z.string().describe("The reply, exactly as it would be posted."),
  rationale: z.string().describe("One sentence for the user: why this reply will get noticed."),
});

const DRAFT_RULES = [
  "You draft replies that a specific person will review, edit and post under their own name.",
  "Write in their voice. Add one concrete thing: a number, a first-hand experience, a respectful disagreement, or a sharp question.",
  "No flattery openers ('Great post', 'This!'), no hashtags, no links, no emoji unless their voice uses them, no self-promotion.",
  "Keep it under 280 characters unless the conversation clearly calls for more. Never invent facts about their life; if you need a specific, phrase it so they can fill it in, like [your number].",
  UNTRUSTED_RULE,
].join("\n");

function relatedPosts(text: string, posts: { text: string }[], n = 3) {
  const words = new Set(text.toLowerCase().match(/[a-z]{5,}/g) ?? []);
  return posts
    .map((p) => ({ p, hits: (p.text.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => words.has(w)).length }))
    .filter((x) => x.hits > 1)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, n)
    .map((x) => x.p.text);
}

/**
 * Drafts a reply for a room, then grades it with the same reply check the user sees
 * and revises once if it would land as Invisible or Polite.
 */
export async function draftReply(userId: string, roomId: string, ctx: { topics: TopicDef[]; voice: VoiceProfile | null; source?: string }) {
  const room = await db.query.room.findFirst({ where: eq(schema.room.id, roomId) });
  if (!room) return null;
  const posts = await db.query.post.findMany({ where: eq(schema.post.accountId, room.accountId), orderBy: desc(schema.post.postedAt), limit: 200, columns: { text: true } });
  const person = await db.query.person.findFirst({ where: and(eq(schema.person.accountId, room.accountId), eq(schema.person.externalId, room.authorExternalId)) });

  const prompt = [
    `Their topics: ${topicLine(ctx.topics)}`,
    voiceBlock(ctx.voice),
    room.aiAngle ? `Angle to use: ${room.aiAngle}` : "",
    person?.aiBrief ? `What they know about the author: ${person.aiBrief}` : "",
    ...relatedPosts(room.text, posts).map((t) => untrusted("their_past_post", t)),
    "",
    "Conversation to reply to:",
    untrusted("post", `${room.authorName} (@${room.authorHandle}):\n${room.text}`),
  ]
    .filter(Boolean)
    .join("\n");

  let out = await structured({ userId, credits: 1, schema: DraftSchema, system: DRAFT_RULES, prompt, effort: "medium" });
  if (!out) return null;
  let check = await gradeReply(out.text, room.text);
  if (check.score < 48) {
    const issues = check.findings.filter((f) => f.tone !== "good").map((f) => `${f.label}: ${f.detail}`);
    const revised = await structured({
      userId,
      credits: 0,
      schema: DraftSchema,
      system: DRAFT_RULES,
      effort: "medium",
      prompt: `${prompt}\n\nYour first draft:\n${out.text}\n\nA reply checker graded it ${check.grade}. Fix these:\n${issues.join("\n") || "It needs something more specific."}`,
    });
    if (revised) {
      const c2 = await gradeReply(revised.text, room.text);
      if (c2.score > check.score) [out, check] = [revised, c2];
    }
  }

  const [row] = await db
    .insert(schema.draft)
    .values({ userId, accountId: room.accountId, kind: "reply", roomId: room.id, text: out.text, rationale: out.rationale, score: check.score, source: ctx.source ?? "autopilot" })
    .onConflictDoUpdate({ target: [schema.draft.roomId, schema.draft.kind], set: { text: out.text, rationale: out.rationale, score: check.score, status: "pending", createdAt: new Date() } })
    .returning();
  return row;
}

const ReshareSchema = z.object({
  text: z.string().describe("A fresh first line to quote the old post with, under 200 characters."),
  rationale: z.string().describe("One sentence on why this framing works now."),
});

export async function draftReshare(userId: string, postId: string, ctx: { voice: VoiceProfile | null; unseen: number }) {
  const p = await db.query.post.findFirst({ where: eq(schema.post.id, postId) });
  if (!p) return null;
  const out = await structured({
    userId,
    credits: 1,
    schema: ReshareSchema,
    effort: "low",
    system: `You help people reshare their own best older posts to newer followers. Write a new opening line in their voice that adds context or a follow-up, never "In case you missed it". ${UNTRUSTED_RULE}`,
    prompt: `${voiceBlock(ctx.voice)}\n\n${Math.round(ctx.unseen * 100)}% of their current followers joined after this went out.\n\n${untrusted("post", p.text)}`,
  });
  if (!out) return null;
  const existing = await db.query.draft.findFirst({ where: and(eq(schema.draft.postId, p.id), eq(schema.draft.status, "pending")) });
  if (existing) {
    await db.update(schema.draft).set({ text: out.text, rationale: out.rationale }).where(eq(schema.draft.id, existing.id));
    return { ...existing, text: out.text, rationale: out.rationale };
  }
  const [row] = await db.insert(schema.draft).values({ userId, accountId: p.accountId, kind: "reshare", postId: p.id, text: out.text, rationale: out.rationale, score: 0 }).returning();
  return row;
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

const PersonSchema = z.object({
  brief: z.string().describe("Two or three sentences: who they are to the user, what they talk about, where things stand."),
  opener: z.string().describe("A short, specific message the user could send to check in. Not generic."),
});

/** A relationship brief plus a check-in message the user can copy. */
export async function briefPerson(userId: string, personId: string, ctx: { voice: VoiceProfile | null; reason?: string }) {
  const p = await db.query.person.findFirst({ where: eq(schema.person.id, personId) });
  if (!p) return null;
  const [ints, theirPosts] = await Promise.all([
    db.query.interaction.findMany({ where: eq(schema.interaction.personId, p.id), orderBy: desc(schema.interaction.occurredAt), limit: 30 }),
    db.query.room.findMany({ where: and(eq(schema.room.accountId, p.accountId), eq(schema.room.authorExternalId, p.externalId)), orderBy: desc(schema.room.postedAt), limit: 5, columns: { text: true } }),
  ]);
  const history = ints.map((i) => `${i.occurredAt.toISOString().slice(0, 10)} ${i.inbound ? "they" : "you"}: ${i.kind}${i.note ? ` (${i.note})` : ""}`);
  const out = await structured({
    userId,
    credits: 1,
    schema: PersonSchema,
    effort: "low",
    system: `You keep a relationship memory for someone who wants genuine connections online, not networking theatre. ${UNTRUSTED_RULE}`,
    prompt: [
      `Person: ${p.name} (@${p.handle}), ${p.followers.toLocaleString()} followers, circle: ${p.circle}.`,
      p.note ? `User's own note: ${p.note}` : "",
      ctx.reason ? `Why now: ${ctx.reason}` : "",
      `Interaction history (newest first):\n${history.join("\n") || "none recorded"}`,
      ...theirPosts.map((t) => untrusted("their_post", t.text)),
      voiceBlock(ctx.voice),
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  if (!out) return null;
  await db.update(schema.person).set({ aiBrief: out.brief, aiBriefAt: new Date() }).where(eq(schema.person.id, p.id));
  const existing = await db.query.draft.findFirst({ where: and(eq(schema.draft.personId, p.id), eq(schema.draft.status, "pending")) });
  if (existing) await db.update(schema.draft).set({ text: out.opener, rationale: ctx.reason ?? out.brief }).where(eq(schema.draft.id, existing.id));
  else await db.insert(schema.draft).values({ userId, accountId: p.accountId, kind: "checkin", personId: p.id, text: out.opener, rationale: ctx.reason ?? out.brief });
  return out;
}

/* ------------------------------------------------------------------ */
/* Briefs                                                              */
/* ------------------------------------------------------------------ */

const BriefSchema = z.object({
  headline: z.string().describe("One line, under 90 characters, plain and specific."),
  body: z.string().describe("Three to five short sentences. Concrete numbers and names. No cheerleading."),
});

export async function writeBrief(userId: string, kind: "morning" | "weekly", facts: string, day: string): Promise<Brief | null> {
  const out = await structured({
    userId,
    credits: 1,
    schema: BriefSchema,
    effort: kind === "weekly" ? "medium" : "low",
    system:
      kind === "morning"
        ? "You write a short morning brief for someone growing on social media by replying and building relationships. Say what matters today and why, using only the facts given."
        : "You write an honest weekly review for someone growing on social media. Say what earned followers, what didn't, and the one change to make next week, using only the facts given. If the data is thin, say so.",
    prompt: facts,
  });
  if (!out) return null;
  const brief: Brief = { day, ...out, generatedAt: new Date().toISOString() };
  await db
    .update(schema.workspace)
    .set(kind === "morning" ? { morningBrief: brief } : { weeklyReview: brief })
    .where(eq(schema.workspace.userId, userId));
  return brief;
}

