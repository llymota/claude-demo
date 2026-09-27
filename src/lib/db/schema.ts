import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Better Auth tables (field names must match Better Auth's model)     */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

export const planEnum = pgEnum("plan", ["free", "grower", "studio"]);

/** Mirror of the customer's Polar state, written by webhooks. Polar stays the source of truth. */
export const subscription = pgTable("subscription", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  polarCustomerId: text("polar_customer_id"),
  polarSubscriptionId: text("polar_subscription_id"),
  productId: text("product_id"),
  plan: planEnum("plan").notNull().default("free"),
  status: text("status").notNull().default("none"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

export interface Topic {
  name: string;
  /** How strongly you can speak to it, 0–1. */
  weight: number;
  /** Search terms. Rooms are found with these and posts are tagged by them. */
  keywords: string[];
}

/** How the user writes, learned from their own posts. Drafts are written to match it. */
export interface VoiceProfile {
  summary: string;
  traits: string[];
  avoid: string[];
  samples: string[];
  learnedFrom: number;
  learnedAt: string;
}

export interface AutopilotSettings {
  enabled: boolean;
  /** Reply drafts prepared per day. */
  draftsPerDay: number;
  /** Email the morning brief. */
  digest: boolean;
  /** Reshare the day's best Second Life pick without asking. Off by default; replies always need approval. */
  autoReshare: boolean;
}

export const DEFAULT_AUTOPILOT: AutopilotSettings = { enabled: true, draftsPerDay: 3, digest: true, autoReshare: false };

export interface Brief {
  day: string;
  headline: string;
  body: string;
  generatedAt: string;
}

export const workspace = pgTable("workspace", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  topics: jsonb("topics").$type<Topic[]>().notNull().default([]),
  timezone: text("timezone").notNull().default("UTC"),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  voice: jsonb("voice").$type<VoiceProfile | null>(),
  autopilot: jsonb("autopilot").$type<AutopilotSettings>().notNull().default(DEFAULT_AUTOPILOT),
  autopilotRanAt: timestamp("autopilot_ran_at", { withTimezone: true }),
  morningBrief: jsonb("morning_brief").$type<Brief | null>(),
  weeklyReview: jsonb("weekly_review").$type<Brief | null>(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const platformEnum = pgEnum("platform", ["bluesky", "x", "threads", "linkedin"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "reauth", "error"]);

/** A social account the user connected. Tokens are AES-256-GCM encrypted (see lib/crypto.ts). */
export const socialAccount = pgTable(
  "social_account",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    externalId: text("external_id").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    followers: integer("followers").notNull().default(0),
    following: integer("following").notNull().default(0),
    pinnedPost: jsonb("pinned_post").$type<{ text: string; postedAt: string; url?: string } | null>(),
    credentials: text("credentials"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes"),
    status: accountStatusEnum("status").notNull().default("active"),
    lastError: text("last_error"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("social_account_unique").on(t.userId, t.platform, t.externalId), index("social_account_sync_idx").on(t.status, t.lastSyncedAt)],
);

/** Opaque key-value store for OAuth libraries (Bluesky state and sessions). Values are encrypted. */
export const oauthStore = pgTable("oauth_store", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const followerSnapshot = pgTable(
  "follower_snapshot",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    followers: integer("followers").notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.day] })],
);

export const sourceEnum = pgEnum("follow_source", ["replies", "relationships", "resurfaced", "profile", "unattributed"]);

/** Individual followers, for platforms that list them. Used to attribute new follows. */
export const follower = pgTable(
  "follower",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    handle: text("handle"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    source: sourceEnum("source"),
    sourceRef: text("source_ref"),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.externalId] }), index("follower_seen_idx").on(t.accountId, t.firstSeenAt)],
);

/** Aggregated follows per day and source. Count-only platforms write "unattributed" deltas here. */
export const followAttribution = pgTable(
  "follow_attribution",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    source: sourceEnum("source").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.day, t.source] })],
);

export const roomStatusEnum = pgEnum("room_status", ["open", "replied", "dismissed", "expired"]);

export const room = pgTable(
  "room",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    /** Platform-specific reference needed to reply (for example a Bluesky cid). */
    replyRef: jsonb("reply_ref").$type<Record<string, string>>(),
    url: text("url").notNull(),
    authorExternalId: text("author_external_id").notNull(),
    authorHandle: text("author_handle").notNull(),
    authorName: text("author_name").notNull(),
    authorFollowers: integer("author_followers"),
    text: text("text").notNull(),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    replyCount: integer("reply_count").notNull().default(0),
    velocity: doublePrecision("velocity").notNull().default(0),
    audienceOverlap: doublePrecision("audience_overlap").notNull().default(0),
    score: integer("score").notNull().default(0),
    breakdown: jsonb("breakdown").$type<{ fit: number; early: number; reach: number; rapport: number; windowMinutes: number }>(),
    manual: boolean("manual").notNull().default(false),
    status: roomStatusEnum("status").notNull().default("open"),
    /** Autopilot's read of the room: worth it, maybe, or skip (bait, off-topic, hostile). */
    aiVerdict: text("ai_verdict").$type<"strong" | "maybe" | "skip">(),
    aiReason: text("ai_reason"),
    /** The angle only this user can bring, drawn from their own posts. */
    aiAngle: text("ai_angle"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("room_unique").on(t.accountId, t.externalId), index("room_rank_idx").on(t.accountId, t.status, t.score)],
);

export const reply = pgTable(
  "reply",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    roomId: text("room_id").references(() => room.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    grade: text("grade").notNull(),
    score: integer("score").notNull(),
    externalId: text("external_id"),
    url: text("url"),
    postedVia: text("posted_via").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("reply_account_idx").on(t.accountId, t.createdAt)],
);

export const circleEnum = pgEnum("circle", ["anchor", "peer", "rising", "fan"]);

export const person = pgTable(
  "person",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    followers: integer("followers").notNull().default(0),
    /** Follower count the first time Tendril saw this person, for growth rates. */
    baselineFollowers: integer("baseline_followers").notNull().default(0),
    baselineAt: timestamp("baseline_at", { withTimezone: true }).notNull().defaultNow(),
    circle: circleEnum("circle").notNull(),
    /** true when the user placed them in a circle by hand; sync will not reclassify. */
    pinnedCircle: boolean("pinned_circle").notNull().default(false),
    note: text("note"),
    lastGreetedAt: timestamp("last_greeted_at", { withTimezone: true }),
    aiBrief: text("ai_brief"),
    aiBriefAt: timestamp("ai_brief_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("person_unique").on(t.accountId, t.externalId)],
);

export const interactionKindEnum = pgEnum("interaction_kind", ["reply-to-me", "my-reply", "mention", "dm", "repost", "collab", "like"]);

export const interaction = pgTable(
  "interaction",
  {
    id: id(),
    personId: text("person_id")
      .notNull()
      .references(() => person.id, { onDelete: "cascade" }),
    kind: interactionKindEnum("kind").notNull(),
    inbound: boolean("inbound").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    externalRef: text("external_ref").notNull(),
    note: text("note"),
  },
  (t) => [uniqueIndex("interaction_unique").on(t.personId, t.kind, t.externalRef), index("interaction_time_idx").on(t.personId, t.occurredAt)],
);

export const post = pgTable(
  "post",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    replyRef: jsonb("reply_ref").$type<Record<string, string>>(),
    url: text("url").notNull(),
    text: text("text").notNull(),
    topic: text("topic"),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    likes: integer("likes").notNull().default(0),
    replies: integer("replies").notNull().default(0),
    reposts: integer("reposts").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    impressions: integer("impressions"),
    dated: boolean("dated").notNull().default(false),
    resurfacedAt: timestamp("resurfaced_at", { withTimezone: true }),
    resurfaceExternalId: text("resurface_external_id"),
  },
  (t) => [uniqueIndex("post_unique").on(t.accountId, t.externalId), index("post_time_idx").on(t.accountId, t.postedAt)],
);

/** Which items of a day's round the user checked off. The round itself is computed. */
export const roundCompletion = pgTable(
  "round_completion",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    itemKey: text("item_key").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.itemKey] })],
);

export const syncRun = pgTable(
  "sync_run",
  {
    id: id(),
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ok: boolean("ok"),
    error: text("error"),
    stats: jsonb("stats").$type<Record<string, number>>(),
  },
  (t) => [index("sync_run_account_idx").on(t.accountId, t.startedAt)],
);

export const auditEvent = pgTable(
  "audit_event",
  {
    id: id(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_user_idx").on(t.userId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* AI: drafts, assistant, usage                                        */
/* ------------------------------------------------------------------ */

export const draftKindEnum = pgEnum("draft_kind", ["reply", "checkin", "reshare"]);
export const draftStatusEnum = pgEnum("draft_status", ["pending", "posted", "discarded"]);

/** Something Autopilot or the assistant prepared. Nothing here is posted until the user approves it. */
export const draft = pgTable(
  "draft",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => socialAccount.id, { onDelete: "cascade" }),
    kind: draftKindEnum("kind").notNull(),
    roomId: text("room_id").references(() => room.id, { onDelete: "cascade" }),
    personId: text("person_id").references(() => person.id, { onDelete: "cascade" }),
    postId: text("post_id").references(() => post.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    rationale: text("rationale"),
    score: integer("score").notNull().default(0),
    status: draftStatusEnum("status").notNull().default("pending"),
    source: text("source").notNull().default("autopilot"),
    resultUrl: text("result_url"),
    createdAt: createdAt(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("draft_user_idx").on(t.userId, t.status, t.createdAt), uniqueIndex("draft_room_unique").on(t.roomId, t.kind)],
);

export const aiThread = pgTable(
  "ai_thread",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("ai_thread_user_idx").on(t.userId, t.updatedAt)],
);

/** Assistant transcript. `content` is the Messages API content array, kept verbatim so turns replay exactly. */
export const aiMessage = pgTable(
  "ai_message",
  {
    id: id(),
    threadId: text("thread_id")
      .notNull()
      .references(() => aiThread.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: jsonb("content").$type<unknown[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("ai_message_thread_idx").on(t.threadId, t.createdAt)],
);

/** Metered AI work per user per month, checked against plan limits. */
export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    credits: integer("credits").notNull().default(0),
    inputTokens: bigint("input_tokens", { mode: "number" }).notNull().default(0),
    outputTokens: bigint("output_tokens", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })],
);
