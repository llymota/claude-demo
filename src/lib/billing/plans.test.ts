import { describe, expect, it } from "vitest";
import { effectivePlan, planForProduct } from "./plans";

describe("effectivePlan", () => {
  const now = new Date("2026-09-26T00:00:00Z");
  it("defaults to free", () => {
    expect(effectivePlan(null, now)).toBe("free");
  });
  it("honours active and trialing subscriptions", () => {
    expect(effectivePlan({ plan: "grower", status: "active", currentPeriodEnd: null }, now)).toBe("grower");
    expect(effectivePlan({ plan: "studio", status: "trialing", currentPeriodEnd: null }, now)).toBe("studio");
  });
  it("keeps a canceled plan until the period ends", () => {
    expect(effectivePlan({ plan: "grower", status: "canceled", currentPeriodEnd: new Date("2026-10-01") }, now)).toBe("grower");
    expect(effectivePlan({ plan: "grower", status: "canceled", currentPeriodEnd: new Date("2026-09-01") }, now)).toBe("free");
  });
  it("drops past-due and revoked subscriptions to free", () => {
    expect(effectivePlan({ plan: "grower", status: "past_due", currentPeriodEnd: new Date("2026-10-01") }, now)).toBe("free");
    expect(effectivePlan({ plan: "grower", status: "revoked", currentPeriodEnd: null }, now)).toBe("free");
  });
});

describe("planForProduct", () => {
  it("maps Polar product ids to plans", () => {
    const products = { grower: "prod_g", studio: "prod_s" };
    expect(planForProduct("prod_g", products)).toBe("grower");
    expect(planForProduct("prod_s", products)).toBe("studio");
    expect(planForProduct("other", products)).toBe("free");
  });
});
