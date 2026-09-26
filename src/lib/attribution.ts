export type FollowSource = "replies" | "relationships" | "resurfaced" | "profile" | "unattributed";

export interface AttributionContext {
  /** People who engaged with replies you posted in the last 7 days, with the reply id. */
  replyEngagers: Map<string, string>;
  /** People who engaged with posts you resurfaced in the last 7 days. */
  resurfaceEngagers: Map<string, string>;
  /** People in Circles you interacted with in the last 30 days. */
  recentPeople: Set<string>;
}

/**
 * Credit a new follower to the last thing of yours they touched. Replies win over
 * resurfaced posts because they reach people outside your audience; anyone left is
 * a profile visit that converted.
 */
export function attributeFollower(externalId: string, ctx: AttributionContext): { source: FollowSource; ref: string | null } {
  const reply = ctx.replyEngagers.get(externalId);
  if (reply) return { source: "replies", ref: reply };
  const resurfaced = ctx.resurfaceEngagers.get(externalId);
  if (resurfaced) return { source: "resurfaced", ref: resurfaced };
  if (ctx.recentPeople.has(externalId)) return { source: "relationships", ref: null };
  return { source: "profile", ref: null };
}

/** Split new follows into listed (attributable) and the remainder the platform didn't list. */
export function followDelta(prevCount: number, nowCount: number, newlyListed: number) {
  const delta = Math.max(0, nowCount - prevCount);
  return { unattributed: Math.max(0, delta - newlyListed) };
}
