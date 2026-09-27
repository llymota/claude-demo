import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { chat } from "@/lib/ai/assistant";
import { db, schema } from "@/lib/db";
import { features } from "@/lib/env";
import { getSession, requireUser } from "@/lib/session";

export const maxDuration = 300;

const body = z.object({ threadId: z.string().optional(), message: z.string().trim().min(1).max(4000) });

/** Streams one assistant turn as newline-delimited JSON events. */
export async function POST(req: Request) {
  if (!(await getSession())) return Response.json({ error: "Sign in first" }, { status: 401 });
  if (!features.ai()) return Response.json({ error: "The assistant isn't configured on this server. Set ANTHROPIC_API_KEY." }, { status: 503 });
  const viewer = await requireUser();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write a message first" }, { status: 400 });

  // Burst guard on top of monthly credits: 30 messages per 10 minutes.
  const [{ n }] = await db
    .select({ n: count() })
    .from(schema.aiMessage)
    .innerJoin(schema.aiThread, eq(schema.aiThread.id, schema.aiMessage.threadId))
    .where(and(eq(schema.aiThread.userId, viewer.user.id), eq(schema.aiMessage.role, "user"), gte(schema.aiMessage.createdAt, new Date(Date.now() - 600_000))));
  if (n >= 60) return Response.json({ error: "That's a lot of questions in a few minutes. Give it a moment." }, { status: 429 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const ev of chat(viewer, parsed.data)) controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
