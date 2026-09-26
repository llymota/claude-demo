import "server-only";
import { cookies } from "next/headers";
import { env } from "./env";
import { decryptJson, encryptJson, randomToken, safeEqual } from "./crypto";
import type { Platform } from "./providers/types";

const COOKIE = "tendril_connect";

interface ConnectState {
  state: string;
  verifier: string;
  userId: string;
  platform: Platform;
  exp: number;
}

/** Stores OAuth state and the PKCE verifier in an encrypted, short-lived, httpOnly cookie. */
export async function beginConnect(userId: string, platform: Platform) {
  const s: ConnectState = { state: randomToken(24), verifier: randomToken(48), userId, platform, exp: Date.now() + 10 * 60_000 };
  (await cookies()).set(COOKIE, encryptJson(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/connect",
    maxAge: 600,
  });
  return s;
}

export async function finishConnect(platform: Platform, state: string | null, userId: string) {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  jar.delete({ name: COOKIE, path: "/api/connect" });
  if (!raw || !state) return null;
  try {
    const s = decryptJson<ConnectState>(raw);
    if (s.platform !== platform || s.userId !== userId || s.exp < Date.now() || !safeEqual(s.state, state)) return null;
    return s;
  } catch {
    return null;
  }
}

export function redirectUri(platform: Platform) {
  return `${env().APP_URL.replace(/\/$/, "")}/api/connect/${platform}/callback`;
}
