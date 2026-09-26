import "server-only";
import { JoseKey, NodeOAuthClient, type NodeSavedSession, type NodeSavedState, type RuntimeLock } from "@atproto/oauth-client-node";
import { eq, sql } from "drizzle-orm";
import { decryptJson, encryptJson } from "../crypto";
import { db, schema } from "../db";
import { env } from "../env";

export const BLUESKY_SCOPE = "atproto transition:generic";

function store<V>(prefix: string, ttlMs?: number) {
  return {
    async set(key: string, value: V) {
      const row = { key: prefix + key, value: encryptJson(value), expiresAt: ttlMs ? new Date(Date.now() + ttlMs) : null };
      await db.insert(schema.oauthStore).values(row).onConflictDoUpdate({ target: schema.oauthStore.key, set: row });
    },
    async get(key: string): Promise<V | undefined> {
      const row = await db.query.oauthStore.findFirst({ where: eq(schema.oauthStore.key, prefix + key) });
      if (!row || (row.expiresAt && row.expiresAt < new Date())) return undefined;
      return decryptJson<V>(row.value);
    },
    async del(key: string) {
      await db.delete(schema.oauthStore).where(eq(schema.oauthStore.key, prefix + key));
    },
  };
}

/** Postgres advisory lock so concurrent workers never refresh the same session twice. */
const requestLock: RuntimeLock = async (key, fn) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"bsky:" + key}))`);
    return fn();
  });

let client: Promise<NodeOAuthClient> | undefined;

/**
 * Production runs as a confidential client (private_key_jwt), which gets long-lived
 * sessions. Local development on http://127.0.0.1 uses the atproto loopback client.
 */
export function blueskyClient() {
  client ??= (async () => {
    const e = env();
    const base = e.APP_URL.replace(/\/$/, "");
    const redirect = `${base}/api/connect/bluesky/callback`;
    const stateStore = store<NodeSavedState>("bsky:state:", 60 * 60 * 1000);
    const sessionStore = store<NodeSavedSession>("bsky:session:");

    if (base.startsWith("https://")) {
      if (!e.BLUESKY_PRIVATE_JWK) throw new Error("BLUESKY_PRIVATE_JWK is required for Bluesky in production");
      return new NodeOAuthClient({
        clientMetadata: {
          client_id: `${base}/oauth/bluesky/client-metadata.json`,
          client_name: "Tendril",
          client_uri: base,
          tos_uri: `${base}/terms`,
          policy_uri: `${base}/privacy`,
          redirect_uris: [redirect],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          scope: BLUESKY_SCOPE,
          application_type: "web",
          token_endpoint_auth_method: "private_key_jwt",
          token_endpoint_auth_signing_alg: "ES256",
          dpop_bound_access_tokens: true,
          jwks_uri: `${base}/oauth/bluesky/jwks.json`,
        },
        keyset: [await JoseKey.fromImportable(e.BLUESKY_PRIVATE_JWK, "tendril-1")],
        stateStore,
        sessionStore,
        requestLock,
      });
    }

    return new NodeOAuthClient({
      clientMetadata: {
        client_id: `http://localhost?redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(BLUESKY_SCOPE)}`,
        redirect_uris: [redirect],
        scope: BLUESKY_SCOPE,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        application_type: "native",
        token_endpoint_auth_method: "none",
        dpop_bound_access_tokens: true,
      },
      stateStore,
      sessionStore,
      requestLock,
    });
  })();
  return client;
}
