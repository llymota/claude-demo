import { NextResponse } from "next/server";
import { blueskyClient } from "@/lib/providers/bluesky-oauth";

/** Public OAuth client metadata. Bluesky's authorization servers fetch this to identify Tendril. */
export async function GET() {
  const client = await blueskyClient();
  return NextResponse.json(client.clientMetadata, { headers: { "Cache-Control": "public, max-age=600" } });
}
