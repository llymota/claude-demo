export type Platform = "bluesky" | "x" | "threads" | "linkedin";

export const PLATFORM_LABEL: Record<Platform, string> = {
  bluesky: "Bluesky",
  x: "X",
  threads: "Threads",
  linkedin: "LinkedIn",
};

/** What each platform's public API actually lets Tendril do. Shown to users as-is. */
export interface Capabilities {
  /** Search public posts to find rooms. */
  rooms: boolean;
  /** Post a reply or quote on the user's behalf, only when they press the button. */
  post: boolean;
  /** Read the user's own post history for Second Life. */
  archive: boolean;
  /** List individual followers (enables per-follower attribution). Otherwise counts only. */
  followerList: boolean;
  /** Read replies and mentions to build Circles. */
  interactions: boolean;
}

export interface AccountRef {
  id: string;
  externalId: string;
  handle: string;
  /** Decrypted provider credentials. Shape is provider-specific. */
  credentials: unknown;
}

export interface ProfileData {
  externalId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followers: number;
  following: number;
  pinnedPost: { text: string; postedAt: string; url?: string } | null;
}

export interface RawRoom {
  externalId: string;
  url: string;
  replyRef?: Record<string, string>;
  authorExternalId: string;
  authorHandle: string;
  authorName: string;
  authorFollowers: number | null;
  /** 0–1 estimate of how much of the author's audience already knows the user. */
  audienceOverlap: number;
  text: string;
  postedAt: Date;
  replyCount: number;
}

export interface RawPost {
  externalId: string;
  url: string;
  replyRef?: Record<string, string>;
  text: string;
  postedAt: Date;
  likes: number;
  replies: number;
  reposts: number;
  saves: number;
  impressions: number | null;
  isReply: boolean;
}

export interface RawInteraction {
  person: { externalId: string; handle: string; name: string; avatarUrl: string | null; followers: number | null };
  kind: "reply-to-me" | "mention" | "repost" | "like";
  occurredAt: Date;
  externalRef: string;
}

export interface RawFollower {
  externalId: string;
  handle: string | null;
}

export interface PostResult {
  externalId: string;
  url: string;
}

/** Credentials changed during a call (refreshed token); persist them. */
export type CredentialUpdate = (credentials: unknown, expiresAt: Date | null) => Promise<void>;

export interface Provider {
  platform: Platform;
  capabilities: Capabilities;
  getProfile(acct: AccountRef, save: CredentialUpdate): Promise<ProfileData>;
  searchRooms(acct: AccountRef, query: string, save: CredentialUpdate, limit: number): Promise<RawRoom[]>;
  getOwnPosts(acct: AccountRef, save: CredentialUpdate, limit: number): Promise<RawPost[]>;
  getInteractions(acct: AccountRef, save: CredentialUpdate, since: Date): Promise<RawInteraction[]>;
  /** Most recent followers first. Providers without follower lists return null. */
  getRecentFollowers(acct: AccountRef, save: CredentialUpdate, limit: number): Promise<RawFollower[] | null>;
  /** People who liked, reposted or replied to the given posts. */
  getEngagers(acct: AccountRef, save: CredentialUpdate, posts: { externalId: string; replyRef?: Record<string, string> | null }[]): Promise<Map<string, Set<string>>>;
  reply(acct: AccountRef, save: CredentialUpdate, target: { externalId: string; replyRef?: Record<string, string> | null }, text: string): Promise<PostResult>;
  quote(acct: AccountRef, save: CredentialUpdate, target: { externalId: string; url: string; replyRef?: Record<string, string> | null }, text: string): Promise<PostResult>;
}

/** Thrown when the user must reconnect (revoked or expired grant). */
export class ReauthRequired extends Error {
  constructor(message = "Reconnect this account to keep syncing") {
    super(message);
    this.name = "ReauthRequired";
  }
}

/** Thrown when the platform tier or app review does not allow a call. Not retried. */
export class NotAvailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotAvailable";
  }
}

export class RateLimited extends Error {
  constructor(public retryAt: Date | null) {
    super("Rate limited by the platform");
    this.name = "RateLimited";
  }
}
