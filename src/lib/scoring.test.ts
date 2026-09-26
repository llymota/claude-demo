import { describe, expect, it } from "vitest";
import {
  auditProfile,
  checkReply,
  classifyCircle,
  earliness,
  estimateOverlap,
  leverage,
  nudges,
  reciprocity,
  resurfaceScore,
  searchQueries,
  tagTopics,
  unseenShare,
  velocity,
  warmth,
  windowMinutes,
  type TopicDef,
} from "./scoring";

const topics: TopicDef[] = [
  { name: "freelance finance", weight: 1, keywords: ["freelance taxes", "invoice", "freelancer"] },
  { name: "pricing", weight: 0.8, keywords: ["pricing", "raise prices"] },
];

describe("topics", () => {
  it("tags by name or keyword, as whole words", () => {
    expect(tagTopics("How much of each invoice should I save?", topics)).toEqual(["freelance finance"]);
    expect(tagTopics("We need to raise prices", topics)).toEqual(["pricing"]);
    expect(tagTopics("invoicer apps", topics)).toEqual([]);
  });

  it("interleaves search terms across topics, strongest first", () => {
    expect(searchQueries(topics, 4)).toEqual(["freelance taxes", "pricing", "invoice", "raise prices"]);
  });
});

describe("rooms", () => {
  const weights = { "freelance finance": 1, pricing: 0.8 };

  it("prefers fresh, quiet threads", () => {
    expect(earliness({ ageMinutes: 5, replies: 1 })).toBeGreaterThan(earliness({ ageMinutes: 90, replies: 40 }));
  });

  it("closes the window when crowded or a day old", () => {
    expect(windowMinutes({ replies: 30, velocity: 1, ageMinutes: 10 })).toBe(30);
    expect(windowMinutes({ replies: 70, velocity: 1, ageMinutes: 10 })).toBe(0);
    expect(windowMinutes({ replies: 0, velocity: 0, ageMinutes: 24 * 60 })).toBe(0);
  });

  it("measures velocity between observations", () => {
    const postedAt = new Date("2026-09-26T10:00:00Z");
    const v = velocity({ replies: 30, at: new Date("2026-09-26T10:30:00Z"), postedAt }, { replies: 20, at: new Date("2026-09-26T10:20:00Z") });
    expect(v).toBeCloseTo(1);
    expect(velocity({ replies: 30, at: new Date("2026-09-26T10:30:00Z"), postedAt })).toBeCloseTo(1);
  });

  it("scores a relevant early thread in a bigger room above a stale one", () => {
    const base = { topics: ["freelance finance"], velocity: 0.5, audienceOverlap: 0.05, authorFollowers: 40000, knownWarmth: null };
    const good = leverage({ ...base, ageMinutes: 10, replies: 3 }, { weights, myFollowers: 2000 });
    const stale = leverage({ ...base, ageMinutes: 600, replies: 55 }, { weights, myFollowers: 2000 });
    expect(good.score).toBeGreaterThan(stale.score);
    expect(good.score).toBeGreaterThan(60);
  });

  it("estimates overlap from relative size when the platform doesn't say", () => {
    expect(estimateOverlap(2000, 200000)).toBeLessThan(estimateOverlap(2000, 2000));
    expect(estimateOverlap(2000, null)).toBe(0.1);
  });
});

describe("reply check", () => {
  it("treats stock praise as invisible", () => {
    expect(checkReply("Great post!").grade).toBe("Invisible");
    expect(checkReply("🔥🔥").grade).toBe("Invisible");
  });

  it("rewards specifics, experience and a question", () => {
    const r = checkReply(
      "When we switched to a separate tax account in 2023, our April panic dropped to zero. The catch: you need to move 30% on every invoice. Do you automate the transfer?",
    );
    expect(r.grade).toBe("Magnetic");
  });

  it("penalises links and self-promotion", () => {
    const r = checkReply("I wrote about this exact problem, check out my newsletter at priya.io for the full breakdown");
    expect(r.findings.some((f) => f.label === "Link in reply")).toBe(true);
    expect(r.score).toBeLessThan(25);
  });
});

describe("circles", () => {
  it("decays warmth over time", () => {
    expect(warmth([{ kind: "dm", inbound: true, daysAgo: 1 }])).toBeGreaterThan(warmth([{ kind: "dm", inbound: true, daysAgo: 90 }]));
    expect(warmth([])).toBe(0);
  });

  it("ignores likes in the reciprocity ledger", () => {
    expect(
      reciprocity([
        { kind: "reply-to-me", inbound: true, daysAgo: 1 },
        { kind: "like", inbound: true, daysAgo: 1 },
        { kind: "my-reply", inbound: false, daysAgo: 1 },
      ]),
    ).toBe(0);
  });

  it("classifies by size, growth and loyalty", () => {
    const none: never[] = [];
    expect(classifyCircle({ followers: 30000, baseline: 30000, baselineDays: 0, interactions: none }, 2000)).toBe("anchor");
    expect(classifyCircle({ followers: 1500, baseline: 600, baselineDays: 60, interactions: none }, 2000)).toBe("rising");
    const loyal = Array.from({ length: 4 }, () => ({ kind: "reply-to-me" as const, inbound: true, daysAgo: 2 }));
    expect(classifyCircle({ followers: 300, baseline: 300, baselineDays: 60, interactions: loyal }, 2000)).toBe("fan");
    expect(classifyCircle({ followers: 2500, baseline: 2400, baselineDays: 60, interactions: none }, 2000)).toBe("peer");
  });

  it("nudges people you owe, and skips anyone greeted this week", () => {
    const owed = [
      { kind: "reply-to-me" as const, inbound: true, daysAgo: 2 },
      { kind: "reply-to-me" as const, inbound: true, daysAgo: 4 },
      { kind: "mention" as const, inbound: true, daysAgo: 5 },
    ];
    const base = { name: "Leah", circle: "peer" as const, followers: 2000, baseline: 2000, interactions: owed };
    expect(nudges([{ ...base, id: "a", lastGreetedDaysAgo: null }])[0].reason).toMatch(/Showed up for you 3 more/);
    expect(nudges([{ ...base, id: "a", lastGreetedDaysAgo: 2 }])).toHaveLength(0);
  });
});

describe("second life", () => {
  const history = [
    { day: "2026-01-01", followers: 500 },
    { day: "2026-05-01", followers: 1200 },
    { day: "2026-09-01", followers: 2000 },
  ];

  it("measures how much of today's audience missed a post", () => {
    expect(unseenShare(new Date("2026-02-10"), history, 2000)).toBeCloseTo(0.75);
    expect(unseenShare(new Date("2025-06-01"), history, 2000)).toBeCloseTo(0.75);
  });

  it("never resurfaces dated, fresh or recently reshared posts", () => {
    const p = { unseen: 0.7, points: 400, p75: 200, topicWeight: 1, dated: false, resurfacedDaysAgo: null, ageDays: 120 };
    expect(resurfaceScore(p)).toBeGreaterThan(80);
    expect(resurfaceScore({ ...p, dated: true })).toBe(0);
    expect(resurfaceScore({ ...p, ageDays: 5 })).toBe(0);
    expect(resurfaceScore({ ...p, resurfacedDaysAgo: 10 })).toBe(0);
  });
});

describe("storefront", () => {
  it("flags a vague bio and a stale pinned post", () => {
    const checks = auditProfile(
      { bio: "Founder. Coffee, spreadsheets.", pinned: { text: "I quit my job", postedAt: "2025-06-01T00:00:00Z" }, topics },
      new Date("2026-09-26"),
    );
    expect(checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(["who", "topic", "proof", "pinned", "pinned-topic"]);
  });

  it("passes a focused bio", () => {
    const checks = auditProfile(
      { bio: "Helping 1,200 freelancers with freelance taxes and pricing.", pinned: { text: "How to price your invoice", postedAt: "2026-08-01T00:00:00Z" }, topics },
      new Date("2026-09-26"),
    );
    expect(checks.every((c) => c.ok)).toBe(true);
  });
});
