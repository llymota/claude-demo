import { NextResponse } from "next/server";
import { blueskyClient } from "@/lib/providers/bluesky-oauth";

/** Public half of the key Tendril signs Bluesky client assertions with. */
export async function GET() {
  const client = await blueskyClient();
  return NextResponse.json(client.jwks, { headers: { "Cache-Control": "public, max-age=600" } });
}
