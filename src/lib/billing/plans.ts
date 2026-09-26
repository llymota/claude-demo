export type Plan = "free" | "grower" | "studio";

export interface PlanSpec {
  id: Plan;
  name: string;
  priceMonthly: number;
  summary: string;
  features: string[];
  limits: {
    /** Connected social accounts. */
    accounts: number;
    /** Rooms shown per day. */
    roomsPerDay: number;
    circles: boolean;
    secondLife: boolean;
    ledger: boolean;
    postFromTendril: boolean;
    export: boolean;
    /** Minutes between background syncs. */
    syncMinutes: number;
  };
}

export const PLANS: Record<Plan, PlanSpec> = {
  free: {
    id: "free",
    name: "Seedling",
    priceMonthly: 0,
    summary: "Try the daily round on one account.",
    features: ["1 connected account", "5 rooms a day", "Reply check", "Storefront check"],
    limits: { accounts: 1, roomsPerDay: 5, circles: false, secondLife: false, ledger: false, postFromTendril: false, export: false, syncMinutes: 360 },
  },
  grower: {
    id: "grower",
    name: "Grower",
    priceMonthly: 19,
    summary: "Everything, for one person on every platform.",
    features: ["Up to 4 accounts", "Unlimited rooms, synced every 15 minutes", "Circles, Second Life and Ledger", "Reply and reshare from Tendril"],
    limits: { accounts: 4, roomsPerDay: Infinity, circles: true, secondLife: true, ledger: true, postFromTendril: true, export: false, syncMinutes: 15 },
  },
  studio: {
    id: "studio",
    name: "Studio",
    priceMonthly: 49,
    summary: "For a founder and their company, or a small team.",
    features: ["Up to 12 accounts", "Everything in Grower", "CSV export of Circles and Ledger", "Priority sync"],
    limits: { accounts: 12, roomsPerDay: Infinity, circles: true, secondLife: true, ledger: true, postFromTendril: true, export: true, syncMinutes: 15 },
  },
};

const ACTIVE = new Set(["active", "trialing"]);

/**
 * Resolve the plan a user is entitled to right now. A canceled subscription keeps
 * its plan until the paid period ends; anything past due falls back to free.
 */
export function effectivePlan(sub: { plan: Plan; status: string; currentPeriodEnd: Date | null } | null | undefined, now = new Date()): Plan {
  if (!sub || sub.plan === "free") return "free";
  if (ACTIVE.has(sub.status)) return sub.plan;
  if (sub.status === "canceled" && sub.currentPeriodEnd && sub.currentPeriodEnd > now) return sub.plan;
  return "free";
}

export function planForProduct(productId: string | null | undefined, products: { grower?: string; studio?: string }): Plan {
  if (productId && productId === products.studio) return "studio";
  if (productId && productId === products.grower) return "grower";
  return "free";
}
