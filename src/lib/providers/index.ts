import "server-only";
import { features } from "../env";
import { bluesky } from "./bluesky";
import { linkedin } from "./linkedin";
import { threads } from "./threads";
import type { Platform, Provider } from "./types";
import { x } from "./x";

export const providers: Record<Platform, Provider> = { bluesky, x, threads, linkedin };

export function providerFor(platform: Platform) {
  return providers[platform];
}

/** Platforms this deployment has credentials for. */
export function enabledPlatforms(): Platform[] {
  return (["bluesky", "x", "threads", "linkedin"] as const).filter((p) => features[p]());
}

export * from "./types";
