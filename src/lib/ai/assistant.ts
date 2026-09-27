import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db";
import { clip, pct } from "../format";
import { log } from "../log";
import { accountsFor, circles, ledger, openRooms, replyStats, secondLife, storefront } from "../queries";
import { gradeReply } from "../jev";
import type { Viewer } from "../session";
import { anthropic, assertCredits, FALLBACK, model, recordUsage, UNTRUSTED_RULE, untrusted } from "./client";
import { draftReply } from "./tasks";

type Json = Record<string, unknown> | unknown[] | string;

interface ToolDef<S extends z.ZodType> {
  name: string;
  label: string;
  description: string;
  input: S;
  run: (input: z.infer<S>) => Promise<Json>;
}

const tool = <S extends z.ZodType>(t: ToolDef<S>) => t;

/** Tools see only the signed-in user's data, and none of them posts anything. */
function toolsFor(viewer: Viewer) {
  const userId = viewer.user.id;
  const ids = async () => (await accountsFor(userId)).map((a) => a.id);

  async function ownedRoom(roomId: string) {
    const r = await db
      .select({ room: schema.room })
      .from(schema.room)
      .innerJoin(schema.socialAccount, eq(schema.socialAccount.id, schema.room.accountId))
      .where(and(eq(schema.room.id, roomId), eq(schema.socialAccount.userId, userId)))
      .limit(1);
    return r[0]?.room;
  }
  async function ownedPerson(personId: string) {
    const r = await db
      .select({ person: schema.person })
      .from(schema.person)
      .innerJoin(schema.socialAccount, eq(schema.socialAccount.id, schema.person.accountId))
      .where(and(eq(schema.person.id, personId), eq(schema.socialAccount.userId, userId)))
      .limit(1);
    return r[0]?.person;
  }
  const roomSummary = (r: Awaited<ReturnType<typeof openRooms>>[number]) => ({
    id: r.id,
    link: `/app/rooms/${r.id}`,
    author: `${r.authorName} (@${r.authorHandle})`,
    post: untrusted("post", clip(r.text, 400)),
    leverage: r.score,
    minutes_left: r.windowLeft,
    replies: r.replyCount,
    new_to_you: pct(1 - r.audienceOverlap),
    topics: r.topics,
    verdict: r.aiVerdict,
    angle: r.aiAngle,
  });

  return [
    tool({
      name: "get_rooms",
      label: "Looking at open rooms",
      description: "List open conversations worth replying to, best first. Optionally filter by a word in the post or author.",
      input: z.object({ query: z.string().optional(), limit: z.number().int().min(1).max(20).optional() }),
      async run({ query, limit }) {
        const rooms = await openRooms(viewer, await ids());
        const q = query?.toLowerCase();
        return rooms
          .filter((r) => !q || r.text.toLowerCase().includes(q) || r.authorHandle.toLowerCase().includes(q) || r.authorName.toLowerCase().includes(q))
          .slice(0, limit ?? 8)
          .map(roomSummary);
      },
    }),
    tool({
      name: "get_room",
      label: "Reading the conversation",
      description: "Full text of one room, plus any draft already prepared for it.",
      input: z.object({ room_id: z.string() }),
      async run({ room_id }) {
        const r = await ownedRoom(room_id);
        if (!r) return "No room with that id.";
        const d = await db.query.draft.findFirst({ where: and(eq(schema.draft.roomId, r.id), eq(schema.draft.status, "pending")) });
        return { id: r.id, link: `/app/rooms/${r.id}`, author: `${r.authorName} (@${r.authorHandle})`, post: untrusted("post", r.text), url: r.url, status: r.status, verdict: r.aiVerdict, reason: r.aiReason, angle: r.aiAngle, pending_draft: d?.text ?? null };
      },
    }),
    tool({
      name: "get_people",
      label: "Checking your circles",
      description: "People in the user's circles with warmth (0-100), balance (positive means they showed up more), days since contact, and who needs attention.",
      input: z.object({ query: z.string().optional(), circle: z.enum(["anchor", "peer", "rising", "fan"]).optional() }),
      async run({ query, circle }) {
        if (!viewer.limits.circles) return "Circles is part of the Grower plan. Tell the user they can upgrade in Settings > Billing.";
        const c = await circles(await ids());
        const q = query?.toLowerCase();
        return {
          people: c.people
            .filter((p) => (!circle || p.circle === circle) && (!q || p.name.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q)))
            .slice(0, 15)
            .map((p) => ({ id: p.id, name: p.name, handle: p.handle, circle: p.circle, followers: p.followers, warmth: p.warmth, balance: p.balance, days_since_contact: Number.isFinite(p.lastContactDays) ? p.lastContactDays : null, note: p.note, brief: p.aiBrief })),
          needs_attention: c.nudges.slice(0, 5).map((n) => ({ id: n.personId, name: n.person.name, reason: n.reason })),
        };
      },
    }),
    tool({
      name: "get_person",
      label: "Remembering your history",
      description: "One person's interaction history with the user, their note and brief.",
      input: z.object({ person_id: z.string() }),
      async run({ person_id }) {
        const p = await ownedPerson(person_id);
        if (!p) return "No person with that id.";
        const ints = await db.query.interaction.findMany({ where: eq(schema.interaction.personId, p.id), orderBy: desc(schema.interaction.occurredAt), limit: 25 });
        return { name: p.name, handle: p.handle, circle: p.circle, followers: p.followers, note: p.note, brief: p.aiBrief, history: ints.map((i) => `${i.occurredAt.toISOString().slice(0, 10)} ${i.inbound ? "they" : "you"}: ${i.kind}${i.note ? ` (${i.note})` : ""}`) };
      },
    }),
    tool({
      name: "get_archive",
      label: "Searching your old posts",
      description: "The user's past posts ranked by Second Life: how many current followers never saw them and how well they did.",
      input: z.object({ limit: z.number().int().min(1).max(10).optional() }),
      async run({ limit }) {
        if (!viewer.limits.secondLife) return "Second Life is part of the Grower plan.";
        const a = await secondLife(await accountsFor(userId), viewer.workspace.topics);
        return a.slice(0, limit ?? 5).map((p) => ({ id: p.id, link: `/app/second-life#${p.id}`, post: untrusted("post", clip(p.text, 300)), posted: p.postedAt.toISOString().slice(0, 10), never_saw_it: pct(p.unseen), likes: p.likes, replies: p.replies, score: p.score }));
      },
    }),
    tool({
      name: "get_growth",
      label: "Reading your Ledger",
      description: "New followers per week by source (replies, relationships, resurfaced, profile, unattributed) and reply stats.",
      input: z.object({ weeks: z.number().int().min(1).max(12).optional() }),
      async run({ weeks }) {
        const acctIds = await ids();
        const [l, stats] = await Promise.all([ledger(acctIds, weeks ?? 6), replyStats(userId, (weeks ?? 6) * 7)]);
        const accounts = await accountsFor(userId);
        return { weekly: l.weekly, replies_sent: stats.n, average_reply_score: stats.avg, accounts: accounts.map((a) => ({ handle: a.handle, platform: a.platform, followers: a.followers })) };
      },
    }),
    tool({
      name: "get_profile",
      label: "Checking your profile",
      description: "The user's bios and pinned posts with the Storefront checks for each connected account.",
      input: z.object({}),
      async run() {
        const accounts = await accountsFor(userId);
        return accounts.map((a) => ({ id: a.id, handle: a.handle, platform: a.platform, bio: a.bio ? untrusted("bio", a.bio) : null, pinned: a.pinnedPost?.text ?? null, checks: storefront(a, viewer.workspace.topics).map((c) => ({ check: c.label, ok: c.ok, detail: c.detail })) }));
      },
    }),
    tool({
      name: "check_reply",
      label: "Grading the reply",
      description: "Run Tendril's reply check on a piece of text. Use it on any reply you suggest before showing it. Pass room_id when the reply is for a room, so it is graded against that post.",
      input: z.object({ text: z.string().min(1).max(3000), room_id: z.string().optional() }),
      async run({ text, room_id }) {
        const r = room_id ? await ownedRoom(room_id) : null;
        const c = await gradeReply(text, r?.text ?? null);
        return { grade: c.grade, score: c.score, findings: c.findings.map((f) => `${f.tone}: ${f.label}. ${f.detail}`) };
      },
    }),
    tool({
      name: "draft_reply",
      label: "Drafting in your voice",
      description: "Write a reply for a room in the user's voice and put it in their Inbox for approval. Nothing is posted.",
      input: z.object({ room_id: z.string() }),
      async run({ room_id }) {
        const r = await ownedRoom(room_id);
        if (!r) return "No room with that id.";
        await assertCredits(userId, viewer.plan);
        const d = await draftReply(userId, r.id, { topics: viewer.workspace.topics, voice: viewer.workspace.voice ?? null, source: "assistant" });
        return d ? { draft: d.text, rationale: d.rationale, score: d.score, inbox: "/app/inbox" } : "Couldn't draft that one.";
      },
    }),
    tool({
      name: "save_draft",
      label: "Saving to your Inbox",
      description: "Save reply text the user agreed on to their Inbox for the given room, replacing any pending draft. Nothing is posted.",
      input: z.object({ room_id: z.string(), text: z.string().min(1).max(3000) }),
      async run({ room_id, text }) {
        const r = await ownedRoom(room_id);
        if (!r) return "No room with that id.";
        const c = await gradeReply(text, r.text);
        await db
          .insert(schema.draft)
          .values({ userId, accountId: r.accountId, kind: "reply", roomId: r.id, text, score: c.score, rationale: "Written with the assistant", source: "assistant" })
          .onConflictDoUpdate({ target: [schema.draft.roomId, schema.draft.kind], set: { text, score: c.score, status: "pending", source: "assistant" } });
        return { saved: true, inbox: "/app/inbox" };
      },
    }),
    tool({
      name: "add_note",
      label: "Updating your notes",
      description: "Replace the user's private note about a person.",
      input: z.object({ person_id: z.string(), note: z.string().max(500) }),
      async run({ person_id, note }) {
        const p = await ownedPerson(person_id);
        if (!p) return "No person with that id.";
        await db.update(schema.person).set({ note: note || null }).where(eq(schema.person.id, p.id));
        return { saved: true };
      },
    }),
    tool({
      name: "hide_room",
      label: "Hiding the room",
      description: "Hide a room the user doesn't want to see.",
      input: z.object({ room_id: z.string() }),
      async run({ room_id }) {
        const r = await ownedRoom(room_id);
        if (!r) return "No room with that id.";
        await db.update(schema.room).set({ status: "dismissed" }).where(eq(schema.room.id, r.id));
        return { hidden: true };
      },
    }),
  ];
}

function system(viewer: Viewer) {
  const v = viewer.workspace.voice;
  return [
    "You are the assistant inside Tendril, a product that helps people grow on social media without posting more: by replying well in the right conversations (Rooms), keeping relationships warm (Circles), resurfacing old posts newer followers missed (Second Life), fixing their profile (Storefront), and seeing what earned followers (Ledger).",
    "You work for one person. Use the tools to look at their real data before answering; never guess numbers.",
    "You can draft and save replies to their Inbox, add notes and hide rooms. You cannot post anything: posting happens only when they approve a draft in the Inbox. Never say you posted.",
    "Suggested replies must pass check_reply at Useful or better. Write them in the user's voice.",
    "Be brief and concrete. Lead with the answer. Plain sentences, short lists when listing. No emoji, no hype.",
    "When you mention a room, person or post, link it with the link field, as markdown: [short label](/app/rooms/...). Only use links that came from a tool.",
    UNTRUSTED_RULE,
    "",
    `User: ${viewer.user.name}. Plan: ${viewer.plan}. Timezone: ${viewer.workspace.timezone}.`,
    `Topics: ${viewer.workspace.topics.map((t) => `${t.name} (weight ${t.weight})`).join(", ") || "none set"}.`,
    v ? `Their voice: ${v.summary} Traits: ${v.traits.join("; ")}. Never: ${v.avoid.join("; ")}.` : "No voice profile learned yet.",
  ].join("\n");
}

export type AssistantEvent =
  | { type: "thread"; id: string }
  | { type: "text"; delta: string }
  | { type: "tool"; label: string }
  | { type: "error"; message: string }
  | { type: "done" };

const MAX_TURNS = 8;

function jsonSchema(s: z.ZodType): Anthropic.Beta.BetaTool.InputSchema {
  const schema = z.toJSONSchema(s) as Record<string, unknown>;
  delete schema.$schema;
  return schema as Anthropic.Beta.BetaTool.InputSchema;
}

/** Runs one user turn: streams text and tool activity, and persists every message verbatim. */
export async function* chat(viewer: Viewer, input: { threadId?: string; message: string }): AsyncGenerator<AssistantEvent> {
  const userId = viewer.user.id;
  let thread = input.threadId ? await db.query.aiThread.findFirst({ where: and(eq(schema.aiThread.id, input.threadId), eq(schema.aiThread.userId, userId)) }) : undefined;
  if (!thread) [thread] = await db.insert(schema.aiThread).values({ userId, title: clip(input.message, 60) }).returning();
  yield { type: "thread", id: thread.id };

  const history = await db.query.aiMessage.findMany({ where: eq(schema.aiMessage.threadId, thread.id), orderBy: asc(schema.aiMessage.createdAt) });
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m) => ({ role: m.role, content: m.content as Anthropic.Beta.BetaContentBlockParam[] }));
  const persist = async (m: Anthropic.Beta.BetaMessageParam) => {
    messages.push(m);
    await db.insert(schema.aiMessage).values({ threadId: thread.id, role: m.role as "user" | "assistant", content: m.content as unknown[] });
  };
  await persist({ role: "user", content: [{ type: "text", text: input.message }] });
  await db.update(schema.aiThread).set({ updatedAt: new Date() }).where(eq(schema.aiThread.id, thread.id));

  const tools = toolsFor(viewer);
  const defs: Anthropic.Beta.BetaToolUnion[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: jsonSchema(t.input),
    eager_input_streaming: true,
  }));
  const byName = new Map(tools.map((t) => [t.name, t]));

  try {
    await assertCredits(userId, viewer.plan);
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const stream = anthropic().beta.messages.stream({
        model: model(),
        max_tokens: 16000,
        ...FALLBACK,
        cache_control: { type: "ephemeral" },
        output_config: { effort: "medium" },
        system: system(viewer),
        tools: defs,
        messages,
      });
      for await (const ev of stream) {
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield { type: "text", delta: ev.delta.text };
      }
      const msg = await stream.finalMessage();
      await recordUsage(userId, turn === 0 ? 1 : 0, msg.usage);
      await persist({ role: "assistant", content: msg.content as Anthropic.Beta.BetaContentBlockParam[] });

      if (msg.stop_reason === "refusal") {
        yield { type: "error", message: "I can't help with that one." };
        break;
      }
      if (msg.stop_reason === "pause_turn") continue;
      const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (!uses.length || msg.stop_reason !== "tool_use") break;

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const u of uses) {
        const t = byName.get(u.name);
        const parsed = t?.input.safeParse(u.input);
        if (!t || !parsed?.success) {
          results.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: t ? `Invalid input: ${parsed?.error?.issues[0]?.message}` : "Unknown tool" });
          continue;
        }
        yield { type: "tool", label: t.label };
        try {
          const out = await t.run(parsed.data as never);
          results.push({ type: "tool_result", tool_use_id: u.id, content: typeof out === "string" ? out : JSON.stringify(out) });
        } catch (err) {
          log.warn("assistant.tool_failed", { userId, tool: u.name, error: err });
          results.push({ type: "tool_result", tool_use_id: u.id, is_error: true, content: err instanceof Error ? err.message : "Tool failed" });
        }
      }
      await persist({ role: "user", content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) yield { type: "error", message: "The assistant is busy right now. Try again in a minute." };
    else if (err instanceof Anthropic.APIError) {
      log.error("assistant.api_error", { userId, status: err.status, error: err });
      yield { type: "error", message: "The assistant hit an error. Try again." };
    } else yield { type: "error", message: err instanceof Error ? err.message : "Something went wrong." };
  }
  yield { type: "done" };
}

/** Plain transcript for rendering: user text and assistant text only. */
export async function transcript(userId: string, threadId: string) {
  const thread = await db.query.aiThread.findFirst({ where: and(eq(schema.aiThread.id, threadId), eq(schema.aiThread.userId, userId)) });
  if (!thread) return null;
  const rows = await db.query.aiMessage.findMany({ where: eq(schema.aiMessage.threadId, thread.id), orderBy: asc(schema.aiMessage.createdAt) });
  const out: { role: "user" | "assistant"; text: string }[] = [];
  for (const r of rows) {
    const blocks = r.content as { type: string; text?: string }[];
    const text = blocks.filter((b) => b.type === "text" && b.text).map((b) => b.text).join("\n\n");
    if (!text) continue;
    const last = out.at(-1);
    if (last && last.role === r.role && r.role === "assistant") last.text += `\n\n${text}`;
    else out.push({ role: r.role, text });
  }
  return { thread, messages: out };
}

export async function recentThreads(userId: string) {
  return db.query.aiThread.findMany({ where: and(eq(schema.aiThread.userId, userId), gte(schema.aiThread.updatedAt, new Date(Date.now() - 30 * 86_400_000))), orderBy: desc(schema.aiThread.updatedAt), limit: 12 });
}

