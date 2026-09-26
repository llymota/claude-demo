import "server-only";
import { and, count, eq } from "drizzle-orm";
import { PLANS } from "./billing/plans";
import { decryptJson, encryptJson } from "./crypto";
import { db, schema } from "./db";
import { effectivePlan } from "./billing/plans";
import type { AccountRef, CredentialUpdate, Platform, ProfileData } from "./providers/types";

export class AccountLimitReached extends Error {
  constructor(public limit: number) {
    super(`Your plan allows ${limit} connected account${limit === 1 ? "" : "s"}`);
  }
}

export async function planFor(userId: string) {
  const sub = await db.query.subscription.findFirst({ where: eq(schema.subscription.userId, userId) });
  return effectivePlan(sub ?? null);
}

/** Create or reconnect a social account. Reconnecting never counts against the plan limit. */
export async function saveAccount(input: {
  userId: string;
  platform: Platform;
  profile: ProfileData;
  credentials: unknown;
  tokenExpiresAt: Date | null;
  scopes: string;
}) {
  const existing = await db.query.socialAccount.findFirst({
    where: and(
      eq(schema.socialAccount.userId, input.userId),
      eq(schema.socialAccount.platform, input.platform),
      eq(schema.socialAccount.externalId, input.profile.externalId),
    ),
  });
  if (!existing) {
    const limit = PLANS[await planFor(input.userId)].limits.accounts;
    const [{ n }] = await db.select({ n: count() }).from(schema.socialAccount).where(eq(schema.socialAccount.userId, input.userId));
    if (n >= limit) throw new AccountLimitReached(limit);
  }
  const values = {
    userId: input.userId,
    platform: input.platform,
    externalId: input.profile.externalId,
    handle: input.profile.handle,
    displayName: input.profile.displayName,
    avatarUrl: input.profile.avatarUrl,
    bio: input.profile.bio,
    followers: input.profile.followers,
    following: input.profile.following,
    pinnedPost: input.profile.pinnedPost,
    credentials: encryptJson(input.credentials),
    tokenExpiresAt: input.tokenExpiresAt,
    scopes: input.scopes,
    status: "active" as const,
    lastError: null,
  };
  const [row] = await db
    .insert(schema.socialAccount)
    .values(values)
    .onConflictDoUpdate({ target: [schema.socialAccount.userId, schema.socialAccount.platform, schema.socialAccount.externalId], set: values })
    .returning();
  await db.insert(schema.auditEvent).values({ userId: input.userId, action: existing ? "account.reconnected" : "account.connected", detail: { platform: input.platform, handle: input.profile.handle } });
  return row;
}

type AccountRow = typeof schema.socialAccount.$inferSelect;

export function toRef(row: AccountRow): AccountRef {
  return { id: row.id, externalId: row.externalId, handle: row.handle, credentials: row.credentials ? decryptJson(row.credentials) : null };
}

export function credentialSaver(accountId: string): CredentialUpdate {
  return async (credentials, expiresAt) => {
    await db.update(schema.socialAccount).set({ credentials: encryptJson(credentials), tokenExpiresAt: expiresAt }).where(eq(schema.socialAccount.id, accountId));
  };
}

export async function ownedAccount(userId: string, accountId: string) {
  return db.query.socialAccount.findFirst({ where: and(eq(schema.socialAccount.id, accountId), eq(schema.socialAccount.userId, userId)) });
}
