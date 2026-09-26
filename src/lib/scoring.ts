import type { ArchivePost, Conversation, Person, Profile, TopicWeights } from "./types";

const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

/* ------------------------------------------------------------------ */
/* Rooms: which live conversations are worth your next ten minutes     */
/* ------------------------------------------------------------------ */

export interface Leverage {
  score: number;
  /** How well you can speak to it. */
  fit: number;
  /** How early you are: fresh post, few replies ahead of you. */
  early: number;
  /** Share of the room that has never seen you. */
  reach: number;
  /** Likelihood the author notices and reciprocates. */
  rapport: number;
  /** Minutes until the reply section is likely too crowded to be seen (>= 60 replies). */
  windowMinutes: number;
}

export const CROWDED_AT = 60;

export function topicFit(topics: string[], weights: TopicWeights): number {
  if (topics.length === 0) return 0;
  const hits = topics.map((t) => weights[t] ?? 0).sort((a, b) => b - a);
  // The strongest topic counts most; secondary topics add depth.
  return clamp(hits[0] * 0.75 + (hits[1] ?? 0) * 0.25);
}

export function earliness(c: Pick<Conversation, "ageMinutes" | "replies">): number {
  const fresh = Math.exp(-c.ageMinutes / 120);
  const roomAhead = 1 - clamp(c.replies / CROWDED_AT);
  return clamp(fresh * 0.5 + roomAhead * 0.5);
}

export function windowMinutes(c: Pick<Conversation, "replies" | "velocity">): number {
  const remaining = CROWDED_AT - c.replies;
  if (remaining <= 0) return 0;
  if (c.velocity <= 0) return 240;
  return Math.min(240, Math.round(remaining / c.velocity));
}

export function rapportFor(c: Conversation, people: Person[], now = 0): number {
  const person = c.personId ? people.find((p) => p.id === c.personId) : undefined;
  if (person) return clamp(0.35 + warmth(person, now) / 100);
  // Strangers: smaller accounts notice replies more often.
  return clamp(0.4 - Math.log10(Math.max(10, c.authorFollowers)) * 0.05, 0.05, 0.35);
}

export function leverage(c: Conversation, profile: Profile, people: Person[]): Leverage {
  const fit = topicFit(c.topics, profile.topics);
  const early = earliness(c);
  const reach = clamp(1 - c.audienceOverlap);
  const rapport = rapportFor(c, people);
  // An audience much bigger than yours is worth more, with diminishing returns.
  const scale = clamp(Math.log10(Math.max(1, c.authorFollowers / Math.max(1, profile.followers))) / 2 + 0.6, 0.4, 1);
  const raw = fit * 0.38 + early * 0.24 + reach * 0.22 + rapport * 0.16;
  return {
    score: Math.round(raw * scale * 100),
    fit,
    early,
    reach,
    rapport,
    windowMinutes: windowMinutes(c),
  };
}

export function rankRooms(convs: Conversation[], profile: Profile, people: Person[]) {
  return convs
    .map((c) => ({ conversation: c, leverage: leverage(c, profile, people) }))
    .filter((r) => r.leverage.windowMinutes > 0)
    .sort((a, b) => b.leverage.score - a.leverage.score);
}

/* ------------------------------------------------------------------ */
/* Reply check: does this reply add something, or is it wallpaper?    */
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

export function checkReply(text: string): ReplyCheck {
  const t = text.trim();
  const lower = t.toLowerCase();
  const findings: ReplyFinding[] = [];

  if (!t) return { score: 0, grade: "Invisible", findings: [] };

  if (EMOJI_ONLY.test(t)) {
    return {
      score: 4,
      grade: "Invisible",
      findings: [{ tone: "bad", label: "Emoji only", detail: "Nobody clicks through to a profile because of an emoji." }],
    };
  }

  let score = 30;
  const words = t.split(/\s+/).filter(Boolean);

  if (words.length < 8) {
    score -= 18;
    findings.push({ tone: "bad", label: "Too thin", detail: `${words.length} words. Give one reason, example or number.` });
  } else if (words.length > 110) {
    score -= 10;
    findings.push({ tone: "warn", label: "Long for a reply", detail: "Past ~110 words people skim. Cut to the one point that matters." });
  } else {
    score += 10;
  }

  const generic = GENERIC.filter((g) => lower.includes(g));
  if (generic.length) {
    score -= 12 * generic.length;
    findings.push({
      tone: words.length < 15 ? "bad" : "warn",
      label: "Stock phrase",
      detail: `"${generic[0]}" is what the other 40 replies say. Lead with your own point instead.`,
    });
  }

  if (/https?:\/\/|www\.|\.com\b|\.io\b/.test(lower)) {
    score -= 15;
    findings.push({ tone: "bad", label: "Link in reply", detail: "Links in replies read as promotion and get down-ranked. Let your profile carry the link." });
  }

  if (/\d/.test(t)) {
    score += 18;
    findings.push({ tone: "good", label: "Has a number", detail: "Specific figures make people stop and check who wrote it." });
  }

  if (/\b(when (we|i)|last (year|month|week)|we (tried|shipped|lost|found|switched)|i (tried|shipped|lost|learned|found|switched)|in my experience)\b/.test(lower)) {
    score += 16;
    findings.push({ tone: "good", label: "Lived experience", detail: "A first-hand story is the one thing nobody else in the thread can post." });
  }

  if (/\b(but|however|although|except|the catch|counterpoint|i'd push back|disagree)\b/.test(lower)) {
    score += 10;
    findings.push({ tone: "good", label: "Adds tension", detail: "A respectful 'yes, but' gets more replies than agreement." });
  }

  if (/\?\s*$/.test(t)) {
    score += 10;
    findings.push({ tone: "good", label: "Ends on a question", detail: "Gives the author a reason to answer you, which puts you on their audience's screen." });
  }

  const me = (lower.match(/\b(i|my|me|mine|our|we)\b/g) ?? []).length;
  const you = (lower.match(/\b(you|your|yours)\b/g) ?? []).length;
  if (me >= 6 && you === 0) {
    score -= 8;
    findings.push({ tone: "warn", label: "All about you", detail: "Tie your story back to their point so it reads as a contribution." });
  }

  if (/\b(dm me|check out my|my newsletter|link in bio|follow me)\b/.test(lower)) {
    score -= 20;
    findings.push({ tone: "bad", label: "Asks for attention", detail: "Asking for the follow costs you the follow. Earn the profile visit." });
  }

  score = Math.round(clamp(score, 0, 100));
  const grade: Grade = score >= 70 ? "Magnetic" : score >= 48 ? "Useful" : score >= 25 ? "Polite" : "Invisible";
  return { score, grade, findings };
}

/* ------------------------------------------------------------------ */
/* Circles: relationship warmth and reciprocity                        */
/* ------------------------------------------------------------------ */

const KIND_WEIGHT = { "reply-to-me": 8, "my-reply": 6, mention: 10, dm: 14, repost: 9, collab: 25 } as const;

/** 0–100. Each interaction decays with a ~3-week half-life. */
export function warmth(p: Person, now = 0): number {
  const halfLife = 21;
  const total = p.interactions.reduce((sum, i) => {
    const age = Math.max(0, i.daysAgo - now);
    return sum + KIND_WEIGHT[i.kind] * Math.pow(0.5, age / halfLife);
  }, 0);
  return Math.round(100 * (1 - Math.exp(-total / 30)));
}

/** Positive: they have shown up for you more than you have for them. */
export function reciprocity(p: Person): number {
  return p.interactions.reduce((n, i) => n + (i.inbound ? 1 : -1), 0);
}

export function daysSinceContact(p: Person): number {
  return p.interactions.length ? Math.min(...p.interactions.map((i) => i.daysAgo)) : Infinity;
}

export function growthRate(p: Person): number {
  return p.followers90dAgo > 0 ? p.followers / p.followers90dAgo - 1 : 0;
}

export type Nudge = { person: Person; reason: string; urgency: number };

export function nudges(people: Person[]): Nudge[] {
  const out: Nudge[] = [];
  for (const p of people) {
    const w = warmth(p);
    const owed = reciprocity(p);
    const quiet = daysSinceContact(p);
    if (owed >= 2) {
      out.push({ person: p, reason: `Showed up for you ${owed} more times than you did for them`, urgency: 60 + owed * 8 });
    } else if (w >= 25 && w < 55 && quiet >= 14) {
      out.push({ person: p, reason: `Cooling off: ${quiet} days since you last talked`, urgency: 50 + quiet });
    } else if (p.circle === "rising" && growthRate(p) > 0.4 && w < 40) {
      out.push({ person: p, reason: `Grew ${Math.round(growthRate(p) * 100)}% in 90 days and you barely know each other`, urgency: 45 + growthRate(p) * 20 });
    }
  }
  return out.sort((a, b) => b.urgency - a.urgency);
}

/* ------------------------------------------------------------------ */
/* Second Life: old posts most of your audience has never seen         */
/* ------------------------------------------------------------------ */

/** Share of today's followers who followed after the post went out. */
export function unseenShare(post: ArchivePost, profile: Profile): number {
  const then = profile.followerHistory[post.postedMonth]?.followers ?? 0;
  const now = profile.followers;
  return now > 0 ? clamp(1 - then / now) : 0;
}

export function engagementRate(post: ArchivePost): number {
  return post.impressions > 0 ? (post.likes + post.replies * 3 + post.saves * 4) / post.impressions : 0;
}

export function resurfaceScore(post: ArchivePost, profile: Profile): number {
  if (post.dated) return 0;
  const unseen = unseenShare(post, profile);
  const quality = clamp(engagementRate(post) / 0.08);
  const fit = profile.topics[post.topic] ?? 0.3;
  return Math.round((unseen * 0.45 + quality * 0.4 + fit * 0.15) * 100);
}

/** Old posts that answer a live conversation: use them as reply material rather than reposts. */
export function archiveMatches(post: ArchivePost, rooms: Conversation[]): Conversation[] {
  return rooms.filter((c) => c.topics.includes(post.topic));
}

/* ------------------------------------------------------------------ */
/* Storefront: does your profile convert the visits you earn?          */
/* ------------------------------------------------------------------ */

export interface ProfileCheck {
  id: string;
  ok: boolean;
  label: string;
  detail: string;
}

export function profileConversion(p: Profile): number {
  return p.profileVisits30d > 0 ? p.followsFromVisits30d / p.profileVisits30d : 0;
}

export function auditProfile(p: Profile): ProfileCheck[] {
  const bio = p.bio.toLowerCase();
  const topTopics = Object.entries(p.topics)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  const mentionsTopic = topTopics.some((t) => bio.includes(t.split(" ")[0].toLowerCase()));
  return [
    {
      id: "who",
      ok: /\b(for|help|helping)\b/.test(bio),
      label: "Says who you help",
      detail: "Visitors decide in about 4 seconds. \"For freelancers who…\" beats a list of job titles.",
    },
    {
      id: "topic",
      ok: mentionsTopic,
      label: "Matches what you reply about",
      detail: `People arrive from your replies on ${topTopics.join(", ")}. Your bio should confirm they found the right person.`,
    },
    {
      id: "proof",
      ok: /\d/.test(p.bio),
      label: "Carries one proof point",
      detail: "A number (customers, years, results) turns a claim into a reason.",
    },
    {
      id: "pinned-fresh",
      ok: p.pinned.postedMonthsAgo <= 6,
      label: "Pinned post is recent",
      detail: `Yours went up ${p.pinned.postedMonthsAgo} months ago. Pin a post from this year that shows your best thinking.`,
    },
    {
      id: "pinned-topic",
      ok: topTopics.includes(p.pinned.topic),
      label: "Pinned post fits your rooms",
      detail: `Your pinned post is about ${p.pinned.topic}, which is not what brings people to your profile any more.`,
    },
  ];
}
