import type { CustomerState } from "@polar-sh/sdk/models/components/customerstate.js";
import { db, schema } from "../db";
import { env } from "../env";
import { log } from "../log";
import { planForProduct, type Plan } from "./plans";

const RANK: Record<Plan, number> = { free: 0, grower: 1, studio: 2 };

/**
 * Mirror a Polar customer state into our subscription table. Called from the
 * customer.state_changed webhook, which Polar sends on every subscription change.
 */
export async function applyCustomerState(state: CustomerState) {
  const userId = state.externalId;
  if (!userId) {
    log.warn("billing.state_without_external_id", { customerId: state.id });
    return;
  }
  const products = { grower: env().POLAR_PRODUCT_GROWER, studio: env().POLAR_PRODUCT_STUDIO };
  const best = [...state.activeSubscriptions]
    .map((s) => ({ s, plan: planForProduct(s.productId, products) }))
    .sort((a, b) => RANK[b.plan] - RANK[a.plan])[0];

  const row = best
    ? {
        userId,
        polarCustomerId: state.id,
        polarSubscriptionId: best.s.id,
        productId: best.s.productId,
        plan: best.plan,
        status: best.s.status,
        currentPeriodEnd: best.s.currentPeriodEnd,
        cancelAtPeriodEnd: best.s.cancelAtPeriodEnd,
      }
    : {
        userId,
        polarCustomerId: state.id,
        polarSubscriptionId: null,
        productId: null,
        plan: "free" as const,
        status: "none",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      };

  // The user may have been deleted between checkout and webhook delivery.
  const exists = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.id, userId), columns: { id: true } });
  if (!exists) return;

  await db.insert(schema.subscription).values(row).onConflictDoUpdate({ target: schema.subscription.userId, set: row });
  log.info("billing.state_applied", { userId, plan: row.plan, status: row.status });
}
