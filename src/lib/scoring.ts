/**
 * Every ranking and scoring rule in Tendril. Pure functions only: no I/O, so
 * they are easy to test and identical wherever they run.
 */

export const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export interface TopicDef {
  name: string;
  weight: number;
  keywords: string[];
}

/* ------------------------------------------------------------------ */
/* Topics                                                              */
/* ------------------------------------------------------------------ */

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Topics whose name or any keyword appears in the text, as whole words. */
export function tagTopics(text: string, topics: TopicDef[]): string[] {
  const lower = text.toLowerCase();
  return topics
    .filter((t) => [t.name, ...t.keywords].some((k) => k.trim() && new RegExp(`(^|\\W)${escapeRe(k.trim().toLowerCase())}(\\W|$)`).test(lower)))
    .map((t) => t.name);
}

export function topicWeights(topics: TopicDef[]): Record<string, number> {
  return Object.fromEntries(topics.map((t) => [t.name, clamp(t.weight)]));
}

/** Search queries for room discovery: the strongest topics' keywords first, capped. */
export function searchQueries(topics: TopicDef[], max = 6): string[] {
  const out: string[] = [];
  const sorted = [...topics].sort((a, b) => b.weight - a.weight);
  for (let round = 0; out.length < max; round++) {
    let added = false;
    for (const t of sorted) {
      const terms = t.keywords.length ? t.keywords : [t.name];
      const k = terms[round];
      if (k && !out.includes(k) && out.length < max) {
        out.push(k);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */

/** Past this many replies a new reply is unlikely to be seen. */
export const CROWDED_AT = 60;

export function topicFit(topics: string[], weights: Record<string, number>): number {
  if (topics.length === 0) return 0;
  const hits = topics.map((t) => weights[t] ?? 0).sort((a, b) => b - a);
  return clamp(hits[0] * 0.75 + (hits[1] ?? 0) * 0.25);
}

export function earliness(r: { ageMinutes: number; replies: number }): number {
  const fresh = Math.exp(-r.ageMinutes / 120);
  const roomAhead = 1 - clamp(r.replies / CROWDED_AT);
  return clamp(fresh * 0.5 + roomAhead * 0.5);
}

/** Minutes until the thread is likely crowded, capped at four hours. */
export function windowMinutes(r: { replies: number; velocity: number; ageMinutes: number }): number {
  const remaining = CROWDED_AT - r.replies;
  if (remaining <= 0) return 0;
  // Conversations go quiet after a day regardless of replies.
  const staleIn = Math.max(0, 24 * 60 - r.ageMinutes);
  if (r.velocity <= 0) return Math.min(240, staleIn);
  return Math.min(240, staleIn, Math.round(remaining / r.velocity));
}

/** Replies per minute: from two observations if we have them, otherwise the lifetime average. */
export function velocity(now: { replies: number; at: Date; postedAt: Date }, prev?: { replies: number; at: Date } | null): number {
  if (prev && now.at > prev.at) {
    const mins = (now.at.getTime() - prev.at.getTime()) / 60_000;
    if (mins >= 1) return Math.max(0, (now.replies - prev.replies) / mins);
  }
  const age = Math.max(1, (now.at.getTime() - now.postedAt.getTime()) / 60_000);
  return now.replies / age;
}

/**
 * Platforms that don't expose audience overlap get an estimate from relative size:
 * a much bigger account's audience mostly hasn't met you.
 */
export function estimateOverlap(myFollowers: number, authorFollowers: number | null): number {
  if (!authorFollowers) return 0.1;
  return clamp((myFollowers / (myFollowers + authorFollowers)) * 0.6);
}

export function rapport(authorFollowers: number | null, knownWarmth: number | null): number {
  if (knownWarmth !== null) return clamp(0.35 + knownWarmth / 100);
  // Strangers: smaller accounts notice replies more often.
  return clamp(0.4 - Math.log10(Math.max(10, authorFollowers ?? 1000)) * 0.05, 0.05, 0.35);
}

export interface RoomInput {
  topics: string[];
  ageMinutes: number;
  replies: number;
  velocity: number;
  audienceOverlap: number;
  authorFollowers: number | null;
  /** Warmth (0–100) if the author is already in Circles. */
  knownWarmth: number | null;
}

export interface Leverage {
  score: number;
  fit: number;
  early: number;
  reach: number;
  rapport: number;
  windowMinutes: number;
}

export function leverage(r: RoomInput, ctx: { weights: Record<string, number>; myFollowers: number }): Leverage {
  const fit = topicFit(r.topics, ctx.weights);
  const early = earliness(r);
  const reach = clamp(1 - r.audienceOverlap);
  const rap = rapport(r.authorFollowers, r.knownWarmth);
  const ratio = (r.authorFollowers ?? ctx.myFollowers) / Math.max(1, ctx.myFollowers);
  const scale = clamp(Math.log10(Math.max(1, ratio)) / 2 + 0.6, 0.4, 1);
  const raw = fit * 0.38 + early * 0.24 + reach * 0.22 + rap * 0.16;
  return { score: Math.round(raw * scale * 100), fit, early, reach, rapport: rap, windowMinutes: windowMinutes(r) };
}

/* ------------------------------------------------------------------ */
/* Reply check                                                         */
/* ------------------------------------------------------------------ */

export type Grade = "Invisible" | "Polite" | "Useful" | "Magnetic";

export interface ReplyFinding {
  tone: "good" | "warn" | "bad";
  label: string;
  detail: string;
}

export interface ReplyCheck {
  score: number;
  grade: Grade;
  findings: ReplyFinding[];
}

const GENERIC = [
  "great post",
  "love this",
  "so true",
  "this is gold",
  "well said",
  "couldn't agree more",
  "could not agree more",
  "100%",
  "facts",
  "this!",
  "spot on",
  "great insight",
  "thanks for sharing",
  "amazing",
  "nailed it",
];

const EMOJI_ONLY = /^[\s\p{Extended_Pictographic}\p{Emoji_Component}]+$/u;

export function gradeFor(score: number): Grade {
  return score >= 70 ? "Magnetic" : score >= 48 ? "Useful" : score >= 25 ? "Polite" : "Invisible";
}

export function checkReply(text: string): ReplyCheck {
  const t = text.trim();
  const lower = t.toLowerCase();
  const findings: ReplyFinding[] = [];

  if (!t) return { score: 0, grade: "Invisible", findings: [] };

  if (EMOJI_ONLY.test(t)) {
    return { score: 4, grade: "Invisible", findings: [{ tone: "bad", label: "Emoji only", detail: "Nobody visits a profile because of an emoji." }] };
  }

  let score = 30;
  const words = t.split(/\s+/).filter(Boolean);

  if (words.length < 8) {
    score -= 18;
    findings.push({ tone: "bad", label: "Too thin", detail: `${words.length} words. Give one reason, example or number.` });
  } else if (words.length > 110) {
    score -= 10;
    findings.push({ tone: "warn", label: "Long for a reply", detail: "Past about 110 words people skim. Keep the one point that matters." });
  } else {
    score += 10;
  }

  const generic = GENERIC.filter((g) => lower.includes(g));
  if (generic.length) {
    score -= 12 * generic.length;
    findings.push({ tone: words.length < 15 ? "bad" : "warn", label: "Stock phrase", detail: `"${generic[0]}" is what every other reply says. Lead with your own point.` });
  }

  if (/https?:\/\/|www\.|\.com\b|\.io\b/.test(lower)) {
    score -= 15;
    findings.push({ tone: "bad", label: "Link in reply", detail: "Links in replies read as promotion and get down-ranked. Let your profile carry the link." });
  }

  if (/\d/.test(t)) {
    score += 18;
    findings.push({ tone: "good", label: "Has a number", detail: "Specific figures make people check who wrote it." });
  }

  if (/\b(when (we|i)|last (year|month|week)|we (tried|shipped|lost|found|switched)|i (tried|shipped|lost|learned|found|switched)|in my experience)\b/.test(lower)) {
    score += 16;
    findings.push({ tone: "good", label: "Lived experience", detail: "A first-hand story is the one thing nobody else in the thread can post." });
  }

  if (/\b(but|however|although|except|the catch|counterpoint|i'd push back|disagree)\b/.test(lower)) {
    score += 10;
    findings.push({ tone: "good", label: "Adds tension", detail: "A respectful 'yes, but' draws more replies than agreement." });
  }

  if (/\?\s*$/.test(t)) {
    score += 10;
    findings.push({ tone: "good", label: "Ends on a question", detail: "Gives the author a reason to answer you in front of their audience." });
  }

  const me = (lower.match(/\b(i|my|me|mine|our|we)\b/g) ?? []).length;
  const you = (lower.match(/\b(you|your|yours)\b/g) ?? []).length;
  if (me >= 6 && you === 0) {
    score -= 8;
    findings.push({ tone: "warn", label: "All about you", detail: "Tie your story back to their point so it reads as a contribution." });
  }

  if (/\b(dm me|check out my|my newsletter|link in bio|follow me)\b/.test(lower)) {
    score -= 20;
    findings.push({ tone: "bad", label: "Asks for attention", detail: "Asking for the follow costs you the follow." });
  }

  score = Math.round(clamp(score, 0, 100));
  return { score, grade: gradeFor(score), findings };
}

/* ------------------------------------------------------------------ */
/* Circles                                                             */
/* ------------------------------------------------------------------ */

export type InteractionKind = "reply-to-me" | "my-reply" | "mention" | "dm" | "repost" | "collab" | "like";
export type Circle = "anchor" | "peer" | "rising" | "fan";

const KIND_WEIGHT: Record<InteractionKind, number> = { "reply-to-me": 8, "my-reply": 6, mention: 10, dm: 14, repost: 9, collab: 25, like: 2 };

export interface InteractionLite {
  kind: InteractionKind;
  inbound: boolean;
  daysAgo: number;
}

/** 0–100. Each interaction decays with a three-week half-life. */
export function warmth(interactions: InteractionLite[]): number {
  const total = interactions.reduce((sum, i) => sum + KIND_WEIGHT[i.kind] * Math.pow(0.5, Math.max(0, i.daysAgo) / 21), 0);
  return Math.round(100 * (1 - Math.exp(-total / 30)));
}

/** Positive: they have shown up for you more than you have for them. Likes don't count. */
export function reciprocity(interactions: InteractionLite[]): number {
  return interactions.filter((i) => i.kind !== "like").reduce((n, i) => n + (i.inbound ? 1 : -1), 0);
}

export function daysSinceContact(interactions: InteractionLite[]): number {
  return interactions.length ? Math.min(...interactions.map((i) => i.daysAgo)) : Infinity;
}

export function growthRate(followers: number, baseline: number): number {
  return baseline > 0 ? followers / baseline - 1 : 0;
}

export function classifyCircle(p: { followers: number; baseline: number; baselineDays: number; interactions: InteractionLite[] }, myFollowers: number): Circle {
  const ratio = p.followers / Math.max(1, myFollowers);
  const inbound = p.interactions.filter((i) => i.inbound && i.kind !== "like").length;
  if (ratio >= 3) return "anchor";
  if (p.baselineDays >= 21 && growthRate(p.followers, p.baseline) > 0.4 && ratio < 2) return "rising";
  if (ratio < 0.5 && inbound >= 3) return "fan";
  return "peer";
}

export interface PersonLite {
  id: string;
  name: string;
  circle: Circle;
  followers: number;
  baseline: number;
  interactions: InteractionLite[];
  lastGreetedDaysAgo: number | null;
}

export interface Nudge {
  personId: string;
  reason: string;
  urgency: number;
}

export function nudges(people: PersonLite[]): Nudge[] {
  const out: Nudge[] = [];
  for (const p of people) {
    if (p.lastGreetedDaysAgo !== null && p.lastGreetedDaysAgo < 7) continue;
    const w = warmth(p.interactions);
    const owed = reciprocity(p.interactions);
    const quiet = daysSinceContact(p.interactions);
    const growth = growthRate(p.followers, p.baseline);
    if (owed >= 2) out.push({ personId: p.id, reason: `Showed up for you ${owed} more times than you did for them`, urgency: 60 + owed * 8 });
    else if (w >= 25 && w < 55 && quiet >= 14 && isFinite(quiet)) out.push({ personId: p.id, reason: `Cooling off: ${quiet} days since you last talked`, urgency: 50 + quiet });
    else if (p.circle === "rising" && growth > 0.4 && w < 40) out.push({ personId: p.id, reason: `Grew ${Math.round(growth * 100)}% since you met and you barely know each other`, urgency: 45 + growth * 20 });
  }
  return out.sort((a, b) => b.urgency - a.urgency);
}

/* ------------------------------------------------------------------ */
/* Second Life                                                         */
/* ------------------------------------------------------------------ */

/** Share of today's followers who followed after the post went out. */
export function unseenShare(postedAt: Date, history: { day: string; followers: number }[], current: number): number {
  if (current <= 0) return 0;
  const day = postedAt.toISOString().slice(0, 10);
  const before = [...history].filter((h) => h.day <= day).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  // Posts older than our history: assume the earliest snapshot, which understates rather than overstates.
  const then = before?.followers ?? [...history].sort((a, b) => (a.day < b.day ? -1 : 1))[0]?.followers ?? current;
  return clamp(1 - then / current);
}

export function engagementPoints(p: { likes: number; replies: number; reposts: number; saves: number }) {
  return p.likes + p.replies * 3 + p.reposts * 2 + p.saves * 4;
}

export function percentile(values: number[], q: number) {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
}

/** 0–100. Posts marked dated or reshared in the last 60 days score 0. */
export function resurfaceScore(p: { unseen: number; points: number; p75: number; topicWeight: number; dated: boolean; resurfacedDaysAgo: number | null; ageDays: number }) {
  if (p.dated) return 0;
  if (p.resurfacedDaysAgo !== null && p.resurfacedDaysAgo < 60) return 0;
  if (p.ageDays < 21) return 0;
  const quality = clamp(p.points / Math.max(1, p.p75));
  return Math.round((p.unseen * 0.45 + quality * 0.4 + p.topicWeight * 0.15) * 100);
}

/* ------------------------------------------------------------------ */
/* Storefront                                                          */
/* ------------------------------------------------------------------ */

export interface ProfileCheck {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
}

export function auditProfile(p: { bio: string | null; pinned: { text: string; postedAt: string } | null; topics: TopicDef[] }, now = new Date()): ProfileCheck[] {
  const bio = (p.bio ?? "").toLowerCase();
  const top = [...p.topics].sort((a, b) => b.weight - a.weight).slice(0, 3);
  const mentionsTopic = top.some((t) => [t.name, ...t.keywords].some((k) => k && bio.includes(k.toLowerCase())));
  const pinnedAgeMonths = p.pinned ? (now.getTime() - new Date(p.pinned.postedAt).getTime()) / (30 * 86_400_000) : null;
  const pinnedTopics = p.pinned ? tagTopics(p.pinned.text, top) : [];
  return [
    { id: "who", ok: /\b(for|help|helping|helps)\b/.test(bio), label: "Says who you help", detail: "Visitors decide in seconds. \"For freelancers who…\" beats a list of job titles." },
    {
      id: "topic",
      ok: top.length === 0 || mentionsTopic,
      label: "Matches what you reply about",
      detail: `People arrive from your replies on ${top.map((t) => t.name).join(", ") || "your topics"}. Your bio should confirm they found the right person.`,
    },
    { id: "proof", ok: /\d/.test(bio), label: "Carries one proof point", detail: "A number (customers, years, results) turns a claim into a reason." },
    {
      id: "pinned",
      ok: pinnedAgeMonths !== null && pinnedAgeMonths <= 6,
      label: "Pinned post is recent",
      detail: pinnedAgeMonths === null ? "Pin a post that shows your best thinking on your main topic." : `Yours went up ${Math.round(pinnedAgeMonths)} months ago. Pin something from the last six months.`,
    },
    {
      id: "pinned-topic",
      ok: p.pinned !== null && (top.length === 0 || pinnedTopics.length > 0),
      label: "Pinned post fits your topics",
      detail: "Your pinned post should be about what brings people to your profile.",
    },
  ];
}

export const HEALTHY_CONVERSION = 0.15;
