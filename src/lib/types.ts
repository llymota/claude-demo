export type Platform = "x" | "linkedin" | "bluesky" | "threads";

export const PLATFORM_LABEL: Record<Platform, string> = {
  x: "X",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
  threads: "Threads",
};

/** Topic weights for the account owner: how strongly they can speak to each topic (0–1). */
export type TopicWeights = Record<string, number>;

export interface Profile {
  name: string;
  handle: string;
  oneLiner: string;
  followers: number;
  topics: TopicWeights;
  /** Follower count at the start of each month, oldest first, ending with the current month. */
  followerHistory: { month: string; followers: number }[];
  profileVisits30d: number;
  followsFromVisits30d: number;
  bio: string;
  pinned: { text: string; postedMonthsAgo: number; topic: string };
}

export interface Conversation {
  id: string;
  platform: Platform;
  author: string;
  authorHandle: string;
  authorFollowers: number;
  /** Share of the author's audience that already follows you (0–1). */
  audienceOverlap: number;
  text: string;
  topics: string[];
  ageMinutes: number;
  replies: number;
  /** Replies per minute over the last 10 minutes. */
  velocity: number;
  /** Person id in Circles if you already know the author. */
  personId?: string;
}

export type InteractionKind = "reply-to-me" | "my-reply" | "mention" | "dm" | "repost" | "collab";

export interface Interaction {
  kind: InteractionKind;
  daysAgo: number;
  /** true when the interaction was the other person engaging with you. */
  inbound: boolean;
  note?: string;
}

export type Circle = "anchor" | "peer" | "rising" | "fan";

export interface Person {
  id: string;
  name: string;
  handle: string;
  platform: Platform;
  followers: number;
  followers90dAgo: number;
  circle: Circle;
  topics: string[];
  interactions: Interaction[];
  context: string;
}

export interface ArchivePost {
  id: string;
  platform: Platform;
  text: string;
  topic: string;
  /** Month index into Profile.followerHistory when the post went out. */
  postedMonth: number;
  likes: number;
  replies: number;
  saves: number;
  impressions: number;
  /** Does the post still hold up (no dated references)? Set by the author on review. */
  dated: boolean;
}

export type Source = "replies" | "resurfaced" | "relationships" | "profile";

export interface WeeklyFollows {
  week: string;
  replies: number;
  resurfaced: number;
  relationships: number;
  profile: number;
}
