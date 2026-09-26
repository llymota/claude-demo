import { describe, expect, it } from "vitest";
import { attributeFollower, followDelta } from "./attribution";

describe("attribution", () => {
  const ctx = {
    replyEngagers: new Map([["a", "reply1"]]),
    resurfaceEngagers: new Map([["a", "post1"], ["b", "post1"]]),
    recentPeople: new Set(["c"]),
  };

  it("credits replies first, then resurfaced posts, then relationships", () => {
    expect(attributeFollower("a", ctx)).toEqual({ source: "replies", ref: "reply1" });
    expect(attributeFollower("b", ctx)).toEqual({ source: "resurfaced", ref: "post1" });
    expect(attributeFollower("c", ctx)).toEqual({ source: "relationships", ref: null });
    expect(attributeFollower("d", ctx)).toEqual({ source: "profile", ref: null });
  });

  it("counts follows the platform didn't list as unattributed", () => {
    expect(followDelta(100, 130, 20)).toEqual({ unattributed: 10 });
    expect(followDelta(100, 90, 0)).toEqual({ unattributed: 0 });
  });
});
