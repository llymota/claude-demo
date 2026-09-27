import { describe, expect, it } from "vitest";
import { postClass, postQuestions, replyGrade, replyQuestions, roomClass, roomQuestions, tagged } from "./classify";
import type { TopicDef } from "./scoring";

const topics: TopicDef[] = [
  { name: "pricing", weight: 1, keywords: ["pricing", "price increase"] },
  { name: "onboarding", weight: 0.6, keywords: [] },
];

const noul = (p: number) => ({ type: "noul" as const, noul: p });
const score = (s: number, confidence = 0.9) => ({ type: "score" as const, score: s, confidence, legend: {}, probabilities: {} });
const choice = (c: string, confidence: number) => ({ type: "choice" as const, choice: c, confidence, probabilities: {} });

describe("questions", () => {
  it("asks one yes/no per topic, with its keywords as examples", () => {
    const q: Record<string, unknown> & ReturnType<typeof roomQuestions> = roomQuestions(topics);
    expect(q.topic_0).toEqual({ type: "noul", instructions: "The post is about pricing (for example pricing, price increase)" });
    expect(q.topic_1).toEqual({ type: "noul", instructions: "The post is about onboarding" });
    expect(q.kind.type).toBe("choice");
    expect(q.invites.criteria).toHaveLength(4);
    expect(postQuestions(topics).dated.type).toBe("noul");
  });

  it("only grades relevance when there is an original post", () => {
    expect("relevant" in replyQuestions(false)).toBe(false);
    expect("relevant" in replyQuestions(true)).toBe(true);
  });
});

describe("tagged", () => {
  it("keeps topics above the threshold, most likely first", () => {
    expect(tagged({ topic_0: noul(0.55), topic_1: noul(0.9) }, topics)).toEqual(["onboarding", "pricing"]);
    expect(tagged({ topic_0: noul(0.3) }, topics)).toEqual([]);
  });
});

describe("roomClass", () => {
  it("skips junk only when Jev is confident", () => {
    expect(roomClass({ topic_0: noul(0.9), kind: choice("bait", 0.92), invites: score(1) }, topics)).toMatchObject({ verdict: "skip", reason: "Engagement bait, 92% sure" });
    expect(roomClass({ topic_0: noul(0.9), kind: choice("bait", 0.5), invites: score(1) }, topics).verdict).toBe("maybe");
  });

  it("marks open discussions as strong", () => {
    const r = roomClass({ topic_0: noul(0.9), kind: choice("discussion", 0.8), invites: score(2.7) }, topics);
    expect(r).toEqual({ topics: ["pricing"], verdict: "strong", reason: "Asks a question you could answer" });
  });

  it("rejects posts that only matched a keyword", () => {
    expect(roomClass({ topic_0: noul(0.1), kind: choice("discussion", 0.9), invites: score(3) }, topics)).toEqual({ topics: [], verdict: "skip", reason: "Not about your topics" });
  });

  it("calls closed statements a maybe", () => {
    expect(roomClass({ topic_0: noul(0.9), kind: choice("discussion", 0.8), invites: score(0.4) }, topics)).toMatchObject({ verdict: "maybe", reason: "On topic, but leaves little to add" });
  });
});

describe("postClass", () => {
  it("retires a post as dated only above the bar", () => {
    expect(postClass({ topic_0: noul(0.8), dated: noul(0.9) }, topics)).toEqual({ topic: "pricing", dated: true });
    expect(postClass({ topic_0: noul(0.2), dated: noul(0.7) }, topics)).toEqual({ topic: null, dated: false });
  });
});

describe("replyGrade", () => {
  const strong = "We raised prices 30% last spring and churn barely moved, but only because we grandfathered annual plans. Did you give existing customers notice?";

  it("rewards specific, additive replies", () => {
    const r = replyGrade(strong, { specific: score(1.8), adds: score(1.9), experience: noul(0.9), question: noul(0.85), tension: noul(0.7), generic: noul(0.05), promo: noul(0.02), relevant: score(1.9) });
    expect(r.by).toBe("jev");
    expect(r.grade).toBe("Magnetic");
    expect(r.findings.map((f) => f.label)).toEqual(expect.arrayContaining(["Specific", "Lived experience", "Asks a real question"]));
  });

  it("sinks stock praise and self-promotion", () => {
    const r = replyGrade("Great post, check out my newsletter for more on this topic!", {
      specific: score(0.2),
      adds: score(0.1),
      experience: noul(0.05),
      question: noul(0.02),
      tension: noul(0.01),
      generic: noul(0.9),
      promo: noul(0.95),
    });
    expect(r.grade).toBe("Invisible");
    expect(r.findings.map((f) => f.label)).toEqual(expect.arrayContaining(["Asks for attention", "Stock phrase"]));
  });

  it("keeps the exact checks from code", () => {
    expect(replyGrade("🔥🔥", {}).grade).toBe("Invisible");
    const withLink = replyGrade(strong + " https://example.com", { specific: score(1.8), adds: score(1.9), relevant: score(2) });
    expect(withLink.findings.some((f) => f.label === "Link in reply")).toBe(true);
  });
});
