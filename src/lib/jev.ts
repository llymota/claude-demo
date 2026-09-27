import "server-only";
import { TypeSafeClient, type EntryType, type Questions, type SystemOneResult } from "@typesafe-ai/sdk";
import { postClass, postQuestions, replyGrade, replyQuestions, roomClass, roomQuestions, type RoomClass } from "./classify";
import { env, features } from "./env";
import { log } from "./log";
import { checkReply, replyMechanics, type ReplyCheck, type TopicDef } from "./scoring";

let client: TypeSafeClient | undefined;

function jev() {
  if (!features.jev()) return null;
  client ??= new TypeSafeClient({ apiKey: env().TYPESAFE_API_KEY, defaultModel: env().JEV_MODEL, timeout: 8_000, retry: { maxRetries: 1 }, logLevel: "off" });
  return client;
}

/**
 * One Jev call. Every question is answered in parallel against the same state.
 * Returns null when Jev isn't configured or the call fails, so callers fall back to the rules.
 */
async function ask<Q extends Questions>(tag: string, state: EntryType, questions: Q): Promise<SystemOneResult<Q>["answers"] | null> {
  const c = jev();
  if (!c || Object.keys(questions).length === 0) return null;
  try {
    const res = await c.systemOne({ state, questions });
    log.debug("jev.answered", { tag, model: res.model, input: res.usage.input_tokens });
    return res.answers;
  } catch (err) {
    log.warn("jev.failed", { tag, error: err });
    return null;
  }
}

/** Topics, junk filter and verdict for a conversation, in one call. Null means use the rules. */
export async function classifyRoom(r: { text: string; authorName: string }, topics: TopicDef[]): Promise<RoomClass | null> {
  if (!topics.length) return null;
  const answers = await ask("room", { author: r.authorName, post: r.text }, roomQuestions(topics));
  return answers ? roomClass(answers, topics) : null;
}

/** Main topic of one of your posts, and whether it's too tied to its moment to reshare. */
export async function classifyPost(text: string, topics: TopicDef[]) {
  const answers = await ask("post", { post: text }, postQuestions(topics));
  return answers ? postClass(answers, topics) : null;
}

/** Grades a reply with Jev when available, otherwise with the built-in rules. */
export async function gradeReply(text: string, original?: string | null): Promise<ReplyCheck> {
  if (replyMechanics(text).invisible) return checkReply(text); // empty or emoji-only: nothing to judge
  const answers = await ask("reply", original ? { original_post: original, reply: text } : { reply: text }, replyQuestions(Boolean(original)));
  return answers ? replyGrade(text, answers) : { ...checkReply(text), by: "rules" };
}

/** Runs fn over items with at most `limit` in flight, keeping Jev well under its rate limit. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
