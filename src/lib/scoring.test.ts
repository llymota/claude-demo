import { archive, conversations, people, profile } from "../data/seed";
import {
  auditProfile,
  checkReply,
  earliness,
  nudges,
  rankRooms,
  reciprocity,
  resurfaceScore,
  unseenShare,
  warmth,
  windowMinutes,
} from "./scoring";
import type { Person } from "./types";

describe("rooms", () => {
  it("drops conversations that are already crowded", () => {
    const ranked = rankRooms(conversations, profile, people);
    expect(ranked.every((r) => r.leverage.windowMinutes > 0)).toBe(true);
    expect(ranked.find((r) => r.conversation.id === "c6")).toBeUndefined();
  });

  it("ranks by score, highest first", () => {
    const scores = rankRooms(conversations, profile, people).map((r) => r.leverage.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it("prefers fresh, quiet threads", () => {
    expect(earliness({ ageMinutes: 5, replies: 1 })).toBeGreaterThan(earliness({ ageMinutes: 90, replies: 40 }));
  });

  it("estimates when the reply window closes", () => {
    expect(windowMinutes({ replies: 30, velocity: 1 })).toBe(30);
    expect(windowMinutes({ replies: 70, velocity: 1 })).toBe(0);
    expect(windowMinutes({ replies: 0, velocity: 0 })).toBe(240);
  });
});

describe("reply check", () => {
  it("treats stock praise as invisible", () => {
    expect(checkReply("Great post!").grade).toBe("Invisible");
    expect(checkReply("🔥🔥").grade).toBe("Invisible");
  });

  it("rewards specifics, experience and a question", () => {
    const r = checkReply(
      "When we switched to a separate tax account in 2023, our April panic dropped to zero. The catch: you need the discipline to move 30% on every invoice. Do you automate the transfer?",
    );
    expect(r.grade).toBe("Magnetic");
    expect(r.findings.map((f) => f.label)).toEqual(
      expect.arrayContaining(["Has a number", "Lived experience", "Ends on a question"]),
    );
  });

  it("penalises links and self-promotion", () => {
    const r = checkReply("I wrote about this exact problem, check out my newsletter at priya.io for the full breakdown");
    expect(r.findings.some((f) => f.label === "Link in reply")).toBe(true);
    expect(r.score).toBeLessThan(25);
  });
});

describe("circles", () => {
  const base: Person = { ...people[0], interactions: [] };

  it("decays warmth over time", () => {
    const recent = warmth({ ...base, interactions: [{ kind: "dm", daysAgo: 1, inbound: true }] });
    const old = warmth({ ...base, interactions: [{ kind: "dm", daysAgo: 90, inbound: true }] });
    expect(recent).toBeGreaterThan(old);
    expect(warmth(base)).toBe(0);
  });

  it("counts who has shown up for whom", () => {
    expect(reciprocity(people.find((p) => p.id === "p3")!)).toBe(3);
  });

  it("nudges you toward people you owe first", () => {
    const top = nudges(people)[0];
    expect(top.reason).toMatch(/Showed up for you/);
  });
});

describe("second life", () => {
  it("measures how much of today's audience missed a post", () => {
    const a1 = archive.find((a) => a.id === "a1")!;
    expect(unseenShare(a1, profile)).toBeCloseTo(1 - 530 / 2340, 5);
  });

  it("never resurfaces dated posts", () => {
    expect(resurfaceScore(archive.find((a) => a.dated)!, profile)).toBe(0);
  });
});

describe("storefront", () => {
  it("flags a stale pinned post", () => {
    const stale = auditProfile(profile).find((c) => c.id === "pinned-fresh")!;
    expect(stale.ok).toBe(false);
  });
});
