// Prints a new ES256 private JWK for BLUESKY_PRIVATE_JWK.
// Usage: npx tsx scripts/generate-bluesky-key.ts
import { JoseKey } from "@atproto/oauth-client-node";

const key = await JoseKey.generate(["ES256"], "tendril-1");
console.log(JSON.stringify(key.privateJwk));
