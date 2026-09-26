import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { effectivePlan, PLANS } from "./billing/plans";
import { db, schema } from "./db";

export const getSession = cache(async () => auth().api.getSession({ headers: await headers() }));

/** The signed-in user with their workspace and plan, or a redirect to sign in. */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const userId = session.user.id;
  const [ws, sub] = await Promise.all([
    db.query.workspace.findFirst({ where: eq(schema.workspace.userId, userId) }),
    db.query.subscription.findFirst({ where: eq(schema.subscription.userId, userId) }),
  ]);
  const workspace = ws ?? (await db.insert(schema.workspace).values({ userId }).onConflictDoNothing().returning())[0] ?? { userId, topics: [], timezone: "UTC", onboardedAt: null };
  const plan = effectivePlan(sub ?? null);
  return { user: session.user, session: session.session, workspace, subscription: sub ?? null, plan, limits: PLANS[plan].limits };
});

export type Viewer = Awaited<ReturnType<typeof requireUser>>;
