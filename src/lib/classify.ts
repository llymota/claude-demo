/**
 * The questions Tendril asks Jev, and how its answers become Tendril's classifications.
 * Pure functions only, so the thresholds are testable without calling the API.
 *
 * Jev judges meaning (is this about pricing? is this bait? does this reply add anything?).
 * Anything that is counting or arithmetic stays in scoring.ts, where it's exact.
 */
import type { ChoiceQuestion, ChoiceResponse, NoulQuestion, NoulResponse, ScoreQuestion, ScoreResponse } from "@typesafe-ai/sdk";
import { clamp, gradeFor, replyMechanics, type ReplyCheck, type ReplyFinding, type TopicDef } from "./scoring";

/** A topic counts as tagged at this probability. */
export const TOPIC_MIN = 0.5;
/** Rooms are hidden as junk only when Jev is at least this confident. */
export const SKIP_MIN = 0.7;
/** Old posts are retired as dated only above this probability; the user can always undo it. */
export const DATED_MIN = 0.85;
/** A reply signal counts when its probability passes this. */
const SIGNAL_MIN = 0.6;

const noul = (instructions: string): NoulQuestion => ({ type: "noul", instructions });

type TopicKey = `topic_${number}`;

export function topicQuestions(topics: TopicDef[]): Record<TopicKey, NoulQuestion> {
  return Object.fromEntries(
    topics.map((t, i) => {
      const examples = t.keywords.filter((k) => k.trim()).slice(0, 6);
      return [`topic_${i}`, noul(`The post is about ${t.name}${examples.length ? ` (for example ${examples.join(", ")})` : ""}`)];
    }),
  );
}

/** Topics Jev tagged, most likely first. */
export function tagged(answers: Record<string, unknown>, topics: TopicDef[]): string[] {
  return topics
    .map((t, i) => ({ name: t.name, p: (answers[`topic_${i}`] as NoulResponse | undefined)?.noul ?? 0 }))
    .filter((x) => x.p >= TOPIC_MIN)
    .sort((a, b) => b.p - a.p)
    .map((x) => x.name);
}

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */

const KIND = {
  discussion: "A genuine question, opinion, story or discussion that a knowledgeable person could add to",
  bait: "Engagement bait or rage bait that asks for likes, follows, reposts or outrage instead of ideas",
  promo: "An advert, giveaway, launch announcement or other promotion",
  spam: "Spam, a scam, or automated bot content",
} as const;

const INVITES = [
  "A closed statement with nothing left to add",
  "Leaves some room for another view",
  "Invites opinions or experiences",
  "Directly asks a question an expert could answer",
] as const;

export function roomQuestions(topics: TopicDef[]) {
  return {
    ...topicQuestions(topics),
    kind: { type: "choice", instructions: "What kind of post this is", criteria: KIND } satisfies ChoiceQuestion<typeof KIND>,
    invites: { type: "score", instructions: "How much the post invites a thoughtful reply", criteria: INVITES } satisfies ScoreQuestion<typeof INVITES>,
  };
}

export interface RoomClass {
  topics: string[];
  verdict: "strong" | "maybe" | "skip";
  reason: string;
}

const KIND_LABEL: Record<keyof typeof KIND, string> = { discussion: "Discussion", bait: "Engagement bait", promo: "Promotion", spam: "Spam or bot" };

export function roomClass(answers: Record<string, unknown>, topics: TopicDef[]): RoomClass {
  const tags = tagged(answers, topics);
  const kind = answers.kind as ChoiceResponse<typeof KIND> | undefined;
  const invites = answers.invites as ScoreResponse | undefined;
  if (!tags.length) return { topics: tags, verdict: "skip", reason: "Not about your topics" };
  if (kind && kind.choice !== "discussion" && kind.confidence >= SKIP_MIN) {
    return { topics: tags, verdict: "skip", reason: `${KIND_LABEL[kind.choice]}, ${Math.round(kind.confidence * 100)}% sure` };
  }
  const openness = invites?.score ?? 0;
  if (kind?.choice === "discussion" && openness >= 2) {
    return { topics: tags, verdict: "strong", reason: openness >= 2.5 ? "Asks a question you could answer" : "Invites opinions and experiences" };
  }
  return { topics: tags, verdict: "maybe", reason: openness < 1 ? "On topic, but leaves little to add" : "On topic, with some room for your view" };
}

/* ------------------------------------------------------------------ */
/* Your own posts                                                      */
/* ------------------------------------------------------------------ */

export function postQuestions(topics: TopicDef[]) {
  return {
    ...topicQuestions(topics),
    dated: noul(
      "The post is tied to a particular moment, such as news, an event, a launch, a specific date, or words like today or this week, and would read as stale if shared again months later",
    ),
  };
}

export function postClass(answers: Record<string, unknown>, topics: TopicDef[]) {
  return { topic: tagged(answers, topics)[0] ?? null, dated: ((answers.dated as NoulResponse | undefined)?.noul ?? 0) >= DATED_MIN };
}

/* ------------------------------------------------------------------ */
/* Replies                                                             */
/* ------------------------------------------------------------------ */

const SPECIFIC = ["Vague or generic", "Some detail", "Concrete: a number, an example, a name or a first-hand detail"] as const;
const ADDS = ["Only agrees, praises or reacts", "Restates the original point", "Adds a new point, experience or counterpoint"] as const;
const RELEVANT = ["Unrelated to the original post", "Loosely related", "Responds directly to the original post's point"] as const;

export function replyQuestions(withContext: boolean) {
  return {
    specific: { type: "score", instructions: "How specific the reply is", criteria: SPECIFIC } satisfies ScoreQuestion<typeof SPECIFIC>,
    adds: { type: "score", instructions: "What the reply adds to the conversation", criteria: ADDS } satisfies ScoreQuestion<typeof ADDS>,
    experience: noul("The reply shares the writer's own first-hand experience"),
    question: noul("The reply asks the author a genuine question"),
    tension: noul("The reply respectfully disagrees, adds a caveat or offers a counterpoint"),
    generic: noul("The reply is stock praise or agreement that could sit under almost any post"),
    promo: noul("The reply promotes the writer by asking for follows or DMs, or pointing to their product, newsletter or link"),
    ...(withContext ? { relevant: { type: "score", instructions: "How directly the reply responds to the original post", criteria: RELEVANT } satisfies ScoreQuestion<typeof RELEVANT> } : {}),
  };
}

/**
 * Composite grade: Jev scores each quality on its own, and the weights live here in code.
 * Length and links come from replyMechanics, since those are counts.
 */
export function replyGrade(text: string, answers: Record<string, unknown>): ReplyCheck {
  const m = replyMechanics(text);
  if (m.invisible) return { ...m.invisible, by: "jev" };
  const s = (k: string) => (answers[k] as ScoreResponse | undefined)?.score;
  const p = (k: string) => (answers[k] as NoulResponse | undefined)?.noul ?? 0;
  const specific = (s("specific") ?? 0) / 2;
  const adds = (s("adds") ?? 0) / 2;
  const relevant = s("relevant");
  const fit = relevant === undefined ? 0.6 : relevant / 2;

  const judged = 100 * (0.26 * specific + 0.26 * adds + 0.14 * p("experience") + 0.1 * p("question") + 0.08 * p("tension") + 0.16 * fit) - 30 * p("generic") - 35 * p("promo");
  const score = Math.round(clamp(judged + m.delta, 0, 100));

  const findings: ReplyFinding[] = [...m.findings];
  if (p("promo") >= SIGNAL_MIN) findings.push({ tone: "bad", label: "Asks for attention", detail: "Asking for the follow costs you the follow." });
  if (p("generic") >= SIGNAL_MIN) findings.push({ tone: "bad", label: "Stock phrase", detail: "This could sit under any post. Lead with your own point." });
  if (relevant !== undefined && relevant < 0.8) findings.push({ tone: "warn", label: "Off the point", detail: "Tie it to what the author actually said." });
  if (specific >= 0.75) findings.push({ tone: "good", label: "Specific", detail: "Concrete details make people check who wrote it." });
  else if (specific < 0.35) findings.push({ tone: "warn", label: "Vague", detail: "Add one number, example or name." });
  if (adds >= 0.75) findings.push({ tone: "good", label: "Adds something new", detail: "It moves the conversation instead of agreeing with it." });
  if (p("experience") >= SIGNAL_MIN) findings.push({ tone: "good", label: "Lived experience", detail: "A first-hand story is the one thing nobody else in the thread can post." });
  if (p("tension") >= SIGNAL_MIN) findings.push({ tone: "good", label: "Adds tension", detail: "A respectful 'yes, but' draws more replies than agreement." });
  if (p("question") >= SIGNAL_MIN) findings.push({ tone: "good", label: "Asks a real question", detail: "Gives the author a reason to answer you in front of their audience." });

  return { score, grade: gradeFor(score), findings, by: "jev" };
}
